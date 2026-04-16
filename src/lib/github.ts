import { Octokit } from "@octokit/rest";
import { parse as parseYaml } from "yaml";

export interface ShareMdConfig {
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
}

function getRepoInfo(): { owner: string; repo: string } {
  const [owner, repo] = (process.env.GITHUB_REPO ?? "").split("/");
  if (!owner || !repo) {
    throw new Error("GITHUB_REPO env var must be set to owner/repo");
  }
  return { owner, repo };
}

function createOctokit(accessToken: string): Octokit {
  return new Octokit({ auth: accessToken });
}

export async function getConfig(accessToken: string): Promise<ShareMdConfig> {
  const octokit = createOctokit(accessToken);
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

export async function listDirectory(
  accessToken: string,
  path: string
): Promise<FileEntry[]> {
  const octokit = createOctokit(accessToken);
  const { owner, repo } = getRepoInfo();

  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
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

export async function getFileContent(
  accessToken: string,
  path: string
): Promise<FileContent> {
  const octokit = createOctokit(accessToken);
  const { owner, repo } = getRepoInfo();

  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
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

export async function getDefaultBranch(accessToken: string): Promise<string> {
  const octokit = createOctokit(accessToken);
  const { owner, repo } = getRepoInfo();

  const { data } = await octokit.repos.get({ owner, repo });
  return data.default_branch;
}

export async function createWorkingBranch(
  accessToken: string,
  branchName: string
): Promise<void> {
  const octokit = createOctokit(accessToken);
  const { owner, repo } = getRepoInfo();

  const defaultBranch = await getDefaultBranch(accessToken);

  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha,
  });
}

export async function saveFile(
  accessToken: string,
  path: string,
  content: string,
  branch: string,
  sha?: string,
  message?: string
): Promise<string> {
  const octokit = createOctokit(accessToken);
  const { owner, repo } = getRepoInfo();

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: message ?? `Update ${path}`,
    content: Buffer.from(content).toString("base64"),
    branch,
    ...(sha ? { sha } : {}),
  });

  return data.content?.sha ?? "";
}

export async function squashMerge(
  accessToken: string,
  branch: string,
  commitMessage: string
): Promise<{ success: boolean; conflicted: boolean }> {
  const octokit = createOctokit(accessToken);
  const { owner, repo } = getRepoInfo();

  const defaultBranch = await getDefaultBranch(accessToken);

  try {
    await octokit.repos.merge({
      owner,
      repo,
      base: defaultBranch,
      head: branch,
      commit_message: commitMessage,
    });

    // Delete the working branch
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

export async function getFileShaOnBranch(
  accessToken: string,
  path: string,
  branch: string
): Promise<string | null> {
  const octokit = createOctokit(accessToken);
  const { owner, repo } = getRepoInfo();

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
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

export async function deleteBranch(
  accessToken: string,
  branch: string
): Promise<void> {
  const octokit = createOctokit(accessToken);
  const { owner, repo } = getRepoInfo();

  try {
    await octokit.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
  } catch {
    // Branch may already be deleted
  }
}
