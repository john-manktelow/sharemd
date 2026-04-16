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

export interface AccessibleRepo {
  owner: string;
  repo: string;
  fullName: string;
}

const DRAFT_BRANCH_PREFIX = "sharemd/drafts/";

// --- App-level auth (cached) ------------------------------------------------

// Maps repo full name (owner/repo) → installation ID.
const repoInstallationCache = new Map<string, number>();
let cachedInstallUrl: string | null = null;

function getAppCredentials(): { appId: string; privateKey: string } {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!appId || !privateKey) {
    throw new Error(
      "GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY env vars must be set"
    );
  }

  return { appId, privateKey };
}

function createAppOctokit(): Octokit {
  const { appId, privateKey } = getAppCredentials();
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey },
  });
}

function createOctokitForInstallation(installationId: number): Octokit {
  const { appId, privateKey } = getAppCredentials();
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId },
  });
}

/**
 * Discovers all installations and their accessible repos. Populates
 * the repo → installation cache and returns the full repo list.
 */
async function discoverAllRepos(): Promise<AccessibleRepo[]> {
  const appOctokit = createAppOctokit();
  const { data: installations } = await appOctokit.apps.listInstallations();

  const allRepos: AccessibleRepo[] = [];

  for (const installation of installations) {
    const octokit = createOctokitForInstallation(installation.id);
    const {
      data: { repositories },
    } = await octokit.apps.listReposAccessibleToInstallation();

    for (const r of repositories) {
      const fullName = r.full_name;
      repoInstallationCache.set(fullName, installation.id);
      allRepos.push({
        owner: r.owner.login,
        repo: r.name,
        fullName,
      });
    }
  }

  return allRepos;
}

/**
 * Gets the installation ID for a specific repo. Uses the cache, falling back
 * to the repo-specific installation lookup endpoint.
 */
async function getInstallationIdForRepo(
  repoFullName: string
): Promise<number> {
  const cached = repoInstallationCache.get(repoFullName);
  if (cached) {
    return cached;
  }

  const { owner, repo } = parseRepoFullName(repoFullName);
  const appOctokit = createAppOctokit();
  const { data } = await appOctokit.apps.getRepoInstallation({ owner, repo });
  repoInstallationCache.set(repoFullName, data.id);
  return data.id;
}

/**
 * Creates an Octokit scoped to the installation that owns the given repo.
 */
async function createInstallationOctokit(
  repoFullName: string
): Promise<Octokit> {
  const installationId = await getInstallationIdForRepo(repoFullName);
  return createOctokitForInstallation(installationId);
}

/**
 * Returns the URL to install the app on a new account/org.
 */
export async function getAppInstallUrl(): Promise<string> {
  if (cachedInstallUrl) {
    return cachedInstallUrl;
  }

  const appOctokit = createAppOctokit();
  const { data: app } = await appOctokit.apps.getAuthenticated();
  cachedInstallUrl = (app?.html_url ?? "") + "/installations/new";
  return cachedInstallUrl;
}

// --- Repo selection ---------------------------------------------------------

function parseRepoFullName(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository name: ${fullName}`);
  }
  return { owner, repo };
}

/**
 * Lists all repositories across all installations of the app.
 */
export async function listAccessibleRepos(): Promise<AccessibleRepo[]> {
  return discoverAllRepos();
}

// --- Helpers ----------------------------------------------------------------

function normalizePath(path: string): string {
  return path.replace(/\/+$/, "");
}

function sanitizeLogin(login: string): string {
  return login.replace(/[^a-zA-Z0-9-]/g, "-");
}

function sanitizeFilePath(path: string): string {
  return path
    .replace(/[^a-zA-Z0-9./_-]/g, "-")
    .replace(/\.\.+/g, ".")
    .replace(/^\/+|\/+$/g, "");
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

// --- Config -----------------------------------------------------------------

export async function getConfig(repoFullName: string): Promise<ShareMdConfig> {
  const octokit = await createInstallationOctokit(repoFullName);
  const { owner, repo } = parseRepoFullName(repoFullName);

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
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      return { directories: [{ path: "docs/", label: "Documentation" }] };
    }
    throw error;
  }
}

export async function getDefaultBranch(repoFullName: string): Promise<string> {
  const octokit = await createInstallationOctokit(repoFullName);
  const { owner, repo } = parseRepoFullName(repoFullName);

  const { data } = await octokit.repos.get({ owner, repo });
  return data.default_branch;
}

export async function getTargetBranch(repoFullName: string): Promise<string> {
  const config = await getConfig(repoFullName);
  return config.targetBranch ?? (await getDefaultBranch(repoFullName));
}

// --- File operations --------------------------------------------------------

export async function listDirectory(
  repoFullName: string,
  path: string
): Promise<FileEntry[]> {
  const octokit = await createInstallationOctokit(repoFullName);
  const { owner, repo } = parseRepoFullName(repoFullName);

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

async function branchExists(
  repoFullName: string,
  branch: string
): Promise<boolean> {
  const octokit = await createInstallationOctokit(repoFullName);
  const { owner, repo } = parseRepoFullName(repoFullName);

  try {
    await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    return true;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      return false;
    }
    throw error;
  }
}

async function readFileOnRef(
  repoFullName: string,
  path: string,
  ref: string
): Promise<{ content: string; sha: string; path: string }> {
  const octokit = await createInstallationOctokit(repoFullName);
  const { owner, repo } = parseRepoFullName(repoFullName);

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
  repoFullName: string,
  login: string,
  path: string
): Promise<FileContent> {
  const draftBranch = draftBranchName(login, path);

  if (await branchExists(repoFullName, draftBranch)) {
    const result = await readFileOnRef(repoFullName, path, draftBranch);
    return { ...result, hasDraft: true };
  }

  const targetBranch = await getTargetBranch(repoFullName);
  const result = await readFileOnRef(repoFullName, path, targetBranch);
  return { ...result, hasDraft: false };
}

// --- Draft operations -------------------------------------------------------

async function ensureDraftBranch(
  repoFullName: string,
  login: string,
  path: string
): Promise<string> {
  const branch = draftBranchName(login, path);

  if (await branchExists(repoFullName, branch)) {
    return branch;
  }

  const octokit = await createInstallationOctokit(repoFullName);
  const { owner, repo } = parseRepoFullName(repoFullName);
  const targetBranch = await getTargetBranch(repoFullName);

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

export async function saveToUserDraft(
  repoFullName: string,
  login: string,
  path: string,
  content: string,
  author: CommitAuthor,
  sha?: string,
  message?: string
): Promise<{ sha: string; branch: string }> {
  const branch = await ensureDraftBranch(repoFullName, login, path);

  const octokit = await createInstallationOctokit(repoFullName);
  const { owner, repo } = parseRepoFullName(repoFullName);

  const currentSha =
    sha ?? (await getFileShaOnBranch(repoFullName, path, branch)) ?? undefined;

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

export async function publishUserDraft(
  repoFullName: string,
  login: string,
  path: string,
  commitMessage: string
): Promise<{ success: boolean; conflicted: boolean }> {
  const branch = draftBranchName(login, path);

  if (!(await branchExists(repoFullName, branch))) {
    return { success: true, conflicted: false };
  }

  const octokit = await createInstallationOctokit(repoFullName);
  const { owner, repo } = parseRepoFullName(repoFullName);
  const targetBranch = await getTargetBranch(repoFullName);

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
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 409
    ) {
      return { success: false, conflicted: true };
    }
    throw error;
  }
}

export async function listUserDrafts(
  repoFullName: string,
  login: string
): Promise<UserDraft[]> {
  const octokit = await createInstallationOctokit(repoFullName);
  const { owner, repo } = parseRepoFullName(repoFullName);
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
  repoFullName: string,
  path: string,
  branch: string
): Promise<string | null> {
  const octokit = await createInstallationOctokit(repoFullName);
  const { owner, repo } = parseRepoFullName(repoFullName);

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
