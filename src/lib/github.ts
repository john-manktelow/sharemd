import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { parse as parseYaml } from "yaml";

export interface ShareMdConfig {
  /**
   * Branch that drafts get merged into. Defaults to the repo's default branch
   * if not specified.
   */
  targetBranch?: string;
  directories: {
    path: string;
    label: string;
  }[];
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
}

export interface FileContent {
  content: string;
  sha: string;
  path: string;
  hasDraft: boolean;
}

export interface CommitAuthor {
  name: string;
  email: string;
}

export interface UserDraft {
  path: string;
  branch: string;
}

const DRAFT_BRANCH_PREFIX = "sharemd/drafts/";

function getRepoInfo(): { owner: string; repo: string } {
  const [owner, repo] = (process.env.GITHUB_REPO ?? "").split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPO env var must be set to owner/repo");
  }
  return { owner, repo };
}

function normalizePath(path: string): string {
  return path.replace(/\/+$/, "");
}

function sanitizeLogin(login: string): string {
  // GitHub logins are already limited to [a-zA-Z0-9-]; strip anything else defensively.
  return login.replace(/[^a-zA-Z0-9-]/g, "-");
}

function sanitizeFilePath(path: string): string {
  // Git allows slashes and dots in branch names. Preserve the path as-is
  // after replacing anything unsafe (keeps round-trip simple for typical paths).
  return path
    .replace(/[^a-zA-Z0-9./_-]/g, "-")
    .replace(/\.\.+/g, ".") // no '..' sequences
    .replace(/^\/+|\/+$/g, ""); // no leading/trailing slashes
}

export function draftBranchName(login: string, filePath: string): string {
  return `${DRAFT_BRANCH_PREFIX}${sanitizeLogin(login)}/${sanitizeFilePath(
    filePath
  )}`;
}

function parseDraftBranch(
  branch: string
): { login: string; filePath: string } | null {
  if (!branch.startsWith(DRAFT_BRANCH_PREFIX)) {
    return null;
  }
  const rest = branch.slice(DRAFT_BRANCH_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash === -1) {
    return null;
  }
  return { login: rest.slice(0, slash), filePath: rest.slice(slash + 1) };
}

/**
 * Creates an Octokit authenticated as a specific installation of the GitHub App.
 */
async function createInstallationOctokit(): Promise<Octokit> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!appId || !privateKey) {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY env vars must be set");
  }

  const { owner, repo } = getRepoInfo();

  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey },
  });

  const { data: installation } = await appOctokit.apps.getRepoInstallation({
    owner,
    repo,
  });

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId: installation.id,
    },
  });
}

export async function getConfig(): Promise<ShareMdConfig> {
  const octokit = await createInstallationOctokit();
  const { owner, repo } = getRepoInfo();

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: ".sharemd.yaml",
    });

    if (Array.isArray(data) || data.type !== "file") {
      throw new Error(".sharemd.yaml is not a file");
    }

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    return parseYaml(content) as ShareMdConfig;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "status" in error && error.status === 404) {
      return { directories: [{ path: "docs/", label: "Documentation" }] };
    }
    throw error;
  }
}

export async function listDirectory(path: string): Promise<FileEntry[]> {
  const octokit = await createInstallationOctokit();
  const { owner, repo } = getRepoInfo();

  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path: normalizePath(path),
  });

  if (!Array.isArray(data)) {
    throw new Error(`${path} is not a directory`);
  }

  return data
    .filter((item) => item.type === "file" || item.type === "dir")
    .filter((item) => item.type === "dir" || item.name.endsWith(".md"))
    .map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type as "file" | "dir",
      sha: item.sha,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "dir" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
}

async function branchExists(branch: string): Promise<boolean> {
  const octokit = await createInstallationOctokit();
  const { owner, repo } = getRepoInfo();

  try {
    await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    return true;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "status" in error && error.status === 404) {
      return false;
    }
    throw error;
  }
}

async function readFileOnRef(
  path: string,
  ref: string
): Promise<{ content: string; sha: string; path: string }> {
  const octokit = await createInstallationOctokit();
  const { owner, repo } = getRepoInfo();

  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path: normalizePath(path),
    ref,
  });

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`${path} is not a file`);
  }

  return {
    content: Buffer.from(data.content, "base64").toString("utf-8"),
    sha: data.sha,
    path: data.path,
  };
}

/**
 * Returns file content — from the user's draft branch if one exists, otherwise
 * from the target branch.
 */
export async function getFileForUser(
  login: string,
  path: string
): Promise<FileContent> {
  const draftBranch = draftBranchName(login, path);

  if (await branchExists(draftBranch)) {
    const result = await readFileOnRef(path, draftBranch);
    return { ...result, hasDraft: true };
  }

  const targetBranch = await getTargetBranch();
  const result = await readFileOnRef(path, targetBranch);
  return { ...result, hasDraft: false };
}

export async function getDefaultBranch(): Promise<string> {
  const octokit = await createInstallationOctokit();
  const { owner, repo } = getRepoInfo();

  const { data } = await octokit.repos.get({ owner, repo });
  return data.default_branch;
}

export async function getTargetBranch(): Promise<string> {
  const config = await getConfig();
  return config.targetBranch ?? (await getDefaultBranch());
}

async function ensureDraftBranch(login: string, path: string): Promise<string> {
  const branch = draftBranchName(login, path);

  if (await branchExists(branch)) {
    return branch;
  }

  const octokit = await createInstallationOctokit();
  const { owner, repo } = getRepoInfo();
  const targetBranch = await getTargetBranch();

  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${targetBranch}`,
  });

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha: ref.object.sha,
  });

  return branch;
}

/**
 * Saves file content to the user's draft branch. Creates the branch if needed.
 * `sha` is the expected current file SHA on the draft branch (or target, for a
 * fresh branch) — omit to let GitHub figure it out (risks overwriting).
 */
export async function saveToUserDraft(
  login: string,
  path: string,
  content: string,
  author: CommitAuthor,
  sha?: string,
  message?: string
): Promise<{ sha: string; branch: string }> {
  const branch = await ensureDraftBranch(login, path);

  const octokit = await createInstallationOctokit();
  const { owner, repo } = getRepoInfo();

  // If sha wasn't supplied, look it up on the draft branch.
  const currentSha = sha ?? (await getFileShaOnBranch(path, branch)) ?? undefined;

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: message ?? `Update ${path}`,
    content: Buffer.from(content).toString("base64"),
    branch,
    author,
    committer: author,
    ...(currentSha ? { sha: currentSha } : {}),
  });

  return { sha: data.content?.sha ?? "", branch };
}

/**
 * Squash-merges the user's draft branch into the target branch and deletes
 * the draft on success. Returns `{ conflicted: true }` with the branch
 * preserved if GitHub cannot auto-merge.
 */
export async function publishUserDraft(
  login: string,
  path: string,
  commitMessage: string
): Promise<{ success: boolean; conflicted: boolean }> {
  const branch = draftBranchName(login, path);

  if (!(await branchExists(branch))) {
    return { success: true, conflicted: false };
  }

  const octokit = await createInstallationOctokit();
  const { owner, repo } = getRepoInfo();
  const targetBranch = await getTargetBranch();

  try {
    await octokit.repos.merge({
      owner,
      repo,
      base: targetBranch,
      head: branch,
      commit_message: commitMessage,
    });

    await octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });

    return { success: true, conflicted: false };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "status" in error && error.status === 409) {
      return { success: false, conflicted: true };
    }
    throw error;
  }
}

/**
 * Lists all draft branches belonging to the given user, returning the file path
 * each one represents.
 */
export async function listUserDrafts(login: string): Promise<UserDraft[]> {
  const octokit = await createInstallationOctokit();
  const { owner, repo } = getRepoInfo();
  const prefix = `${DRAFT_BRANCH_PREFIX}${sanitizeLogin(login)}/`;

  const { data } = await octokit.git.listMatchingRefs({
    owner,
    repo,
    ref: `heads/${prefix}`,
  });

  const drafts: UserDraft[] = [];
  for (const ref of data) {
    const branch = ref.ref.replace(/^refs\/heads\//, "");
    const parsed = parseDraftBranch(branch);
    if (parsed) {
      drafts.push({ path: parsed.filePath, branch });
    }
  }
  return drafts;
}

export async function getFileShaOnBranch(
  path: string,
  branch: string
): Promise<string | null> {
  const octokit = await createInstallationOctokit();
  const { owner, repo } = getRepoInfo();

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: normalizePath(path),
      ref: branch,
    });

    if (Array.isArray(data) || data.type !== "file") {
      return null;
    }

    return data.sha;
  } catch {
    return null;
  }
}
