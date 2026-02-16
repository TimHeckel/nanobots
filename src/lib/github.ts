import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://nanobots.sh";

let _appOctokit: Octokit | null = null;

function getAppOctokit(): Octokit {
  if (_appOctokit) return _appOctokit;

  const appId = process.env.GITHUB_APP_ID;
  const privateKeyB64 = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKeyB64) {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set");
  }

  const privateKey = Buffer.from(privateKeyB64, "base64").toString("utf-8");

  _appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId: Number(appId), privateKey },
  });

  return _appOctokit;
}

/**
 * Append a dashboard link footer to a PR or issue body.
 */
export function appendDashboardLink(body: string, botName: string, orgLogin?: string): string {
  const chatUrl = orgLogin ? `${APP_URL}/chat?org=${orgLogin}` : `${APP_URL}/chat`;
  return `${body}\n\n---\n*Automated by [nanobots.sh](${chatUrl}) — ${botName} nanobot*`;
}

/**
 * Find a nanobots GitHub App installation matching one of the user's orgs.
 * Uses the App's own authenticated API (not the user's OAuth token).
 */
export async function findInstallationForOrgs(
  orgLogins: string[]
): Promise<{ installationId: number; login: string; orgId: number; avatarUrl: string } | null> {
  if (orgLogins.length === 0) return null;

  try {
    const app = getAppOctokit();
    const loginSet = new Set(orgLogins.map((l) => l.toLowerCase()));

    for await (const response of app.paginate.iterator(app.apps.listInstallations, {
      per_page: 100,
    })) {
      for (const install of response.data) {
        if (install.account && loginSet.has(install.account.login.toLowerCase())) {
          return {
            installationId: install.id,
            login: install.account.login,
            orgId: install.account.id,
            avatarUrl: (install.account as { avatar_url?: string }).avatar_url ?? "",
          };
        }
      }
    }
  } catch (err) {
    console.error("[github] Failed to list app installations:", err);
  }

  return null;
}

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyB64 = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKeyB64) {
    throw new Error("GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set");
  }

  const privateKey = Buffer.from(privateKeyB64, "base64").toString("utf-8");

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: Number(appId),
      privateKey,
      installationId,
    },
  });
}

/**
 * Fetch the full file tree for a repo (recursive).
 * Returns file paths and their SHA for content fetching.
 */
export async function getRepoTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string = "HEAD"
): Promise<Array<{ path: string; sha: string; size: number }>> {
  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: ref,
    recursive: "1",
  });

  return data.tree
    .filter((f) => f.type === "blob" && f.path && f.sha && f.size !== undefined)
    .map((f) => ({ path: f.path!, sha: f.sha!, size: f.size! }));
}

/**
 * Fetch a single file's content (base64 decoded).
 */
export async function getFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<{ content: string; sha: string }> {
  const params: { owner: string; repo: string; path: string; ref?: string } = {
    owner,
    repo,
    path,
  };
  if (ref) params.ref = ref;

  const { data } = await octokit.repos.getContent(params);

  if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
    throw new Error(`${path} is not a file`);
  }

  return {
    content: Buffer.from(data.content, "base64").toString("utf-8"),
    sha: data.sha,
  };
}

/**
 * Create a branch, commit file changes, and open a PR.
 * This is the core action every nanobot uses to deliver fixes.
 */
export async function createFixPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  params: {
    branchName: string;
    title: string;
    body: string;
    files: Array<{ path: string; content: string }>;
    deletedFiles?: string[];
    baseBranch?: string;
  }
): Promise<{ prUrl: string; prNumber: number }> {
  // Get the default branch and its HEAD SHA
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const baseBranch = params.baseBranch || repoData.default_branch;

  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });
  const baseSha = refData.object.sha;

  // Create the new branch
  try {
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${params.branchName}`,
      sha: baseSha,
    });
  } catch (err: unknown) {
    const error = err as { status?: number };
    if (error.status === 422) {
      // Branch already exists — update it
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${params.branchName}`,
        sha: baseSha,
        force: true,
      });
    } else {
      throw err;
    }
  }

  // Get the base tree
  const { data: baseCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: baseSha,
  });

  // Create blobs for each changed file
  const treeItems: Array<{
    path: string;
    mode: "100644";
    type: "blob";
    sha: string | null;
  }> = [];

  for (const file of params.files) {
    const { data: blob } = await octokit.git.createBlob({
      owner,
      repo,
      content: file.content,
      encoding: "utf-8",
    });
    treeItems.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  // Mark deleted files
  for (const path of params.deletedFiles ?? []) {
    treeItems.push({
      path,
      mode: "100644",
      type: "blob",
      sha: null,
    });
  }

  // Create new tree
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseCommit.tree.sha,
    tree: treeItems,
  });

  // Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: params.title,
    tree: newTree.sha,
    parents: [baseSha],
  });

  // Update branch to point to new commit
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${params.branchName}`,
    sha: newCommit.sha,
  });

  // Create PR
  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: params.title,
    body: params.body,
    head: params.branchName,
    base: baseBranch,
  });

  return { prUrl: pr.html_url, prNumber: pr.number };
}
