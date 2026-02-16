import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runAllNanobots } from "@/lib/nanobots/orchestrator";
import { parseCommand } from "@/lib/nanobots/commands";
import { handleCommand } from "@/lib/nanobots/agent";
import { getInstallationOctokit } from "@/lib/github";
import { createOrganization, getOrgByInstallationId } from "@/lib/db/queries/organizations";
import { addMember } from "@/lib/db/queries/org-members";
import { upsertRepos } from "@/lib/db/queries/org-repos";
import { createDefaultBotConfigs } from "@/lib/db/queries/bot-configs";
import { seedDefaultPrompts } from "@/lib/db/queries/system-prompts";
import { logActivity } from "@/lib/db/queries/activity-log";
import { getUserByGithubId } from "@/lib/db/queries/users";

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("GITHUB_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  const payload = JSON.parse(body);

  console.log(`[webhook] ${event} — action: ${payload.action ?? "n/a"}`);

  // Respond immediately, process async
  const response = NextResponse.json({ ok: true });

  switch (event) {
    case "installation":
      handleInstallation(payload);
      break;
    case "installation_repositories":
      handleInstallationRepositories(payload);
      break;
    case "push":
      handlePush(payload);
      break;
    case "issue_comment":
      handleIssueComment(payload);
      break;
  }

  return response;
}

async function handleInstallation(payload: Record<string, unknown>) {
  const action = payload.action as string;
  if (action !== "created") return;

  const installation = payload.installation as Record<string, unknown>;
  const installationId = installation?.id as number;
  const account = installation?.account as Record<string, unknown>;
  const repos = (payload.repositories as Array<Record<string, unknown>>) ?? [];

  // Extract sender (installer) info
  const sender = payload.sender as Record<string, unknown>;
  const senderGithubId = sender?.id as number;
  const senderLogin = sender?.login as string;
  const senderAvatarUrl = (sender?.avatar_url as string) ?? null;

  // Extract account (org or user) info
  const accountGithubId = account?.id as number;
  const accountLogin = account?.login as string;
  const accountAvatarUrl = (account?.avatar_url as string) ?? null;
  const accountType = account?.type as string; // "Organization" or "User"

  console.log(
    `[install] New installation ${installationId} for ${accountType} "${accountLogin}" by ${senderLogin} with ${repos.length} repos`
  );

  try {
    // Create organization in DB
    const org = await createOrganization({
      github_installation_id: installationId,
      github_org_login: accountLogin,
      github_org_id: accountGithubId,
      name: accountLogin,
      avatar_url: accountAvatarUrl,
    });

    console.log(`[install] Created org ${org.id} for ${accountLogin}`);

    // Upsert repos
    if (repos.length > 0) {
      const repoData = repos.map((r) => ({
        github_repo_id: r.id as number,
        full_name: r.full_name as string,
      }));
      await upsertRepos(org.id, repoData);
      console.log(`[install] Upserted ${repos.length} repos for org ${org.id}`);
    }

    // Look up the installer user and add as admin
    const installerUser = await getUserByGithubId(senderGithubId);
    if (installerUser) {
      await addMember({ org_id: org.id, user_id: installerUser.id, role: "admin" });
      console.log(`[install] Added ${senderLogin} as admin for org ${org.id}`);
    } else {
      console.log(
        `[install] Installer ${senderLogin} (github_id: ${senderGithubId}) not found in users table — they will be linked on first login`
      );
    }

    // Create default bot configs
    await createDefaultBotConfigs(org.id);
    console.log(`[install] Created default bot configs for org ${org.id}`);

    // Seed default prompts
    await seedDefaultPrompts();
    console.log(`[install] Seeded default prompts`);

    // Log activity
    await logActivity(
      org.id,
      "app_installed",
      "nanobots GitHub App installed",
      {
        installation_id: installationId,
        account_login: accountLogin,
        account_type: accountType,
        installer_login: senderLogin,
        repo_count: repos.length,
      },
      installerUser?.id
    );
  } catch (err) {
    console.error(`[install] DB setup failed for installation ${installationId}:`, err);
  }

  // Run nanobots scans on all repos (existing behavior)
  for (const repo of repos) {
    const fullName = repo.full_name as string;
    const [owner, name] = fullName.split("/");

    runAllNanobots(installationId, owner, name, { category: "security" }).then((prUrls) => {
      if (prUrls.length > 0) {
        console.log(`[install] ${fullName}: created ${prUrls.length} PRs`);
      }
    }).catch((err) => {
      console.error(`[install] ${fullName} scan failed:`, err);
    });
  }
}

async function handleInstallationRepositories(payload: Record<string, unknown>) {
  const installation = payload.installation as Record<string, unknown>;
  const installationId = installation?.id as number;

  const org = await getOrgByInstallationId(installationId);
  if (!org) {
    console.error(`[repos] No org found for installation ${installationId}`);
    return;
  }

  const reposAdded = (payload.repositories_added as Array<Record<string, unknown>>) ?? [];
  const reposRemoved = (payload.repositories_removed as Array<Record<string, unknown>>) ?? [];

  // Upsert newly added repos
  if (reposAdded.length > 0) {
    const repoData = reposAdded.map((r) => ({
      github_repo_id: r.id as number,
      full_name: r.full_name as string,
    }));
    await upsertRepos(org.id, repoData);
    console.log(`[repos] Added ${reposAdded.length} repos to org ${org.id}`);
  }

  // Log removed repos
  if (reposRemoved.length > 0) {
    const removedNames = reposRemoved.map((r) => r.full_name as string);
    console.log(`[repos] Removed repos from installation ${installationId}: ${removedNames.join(", ")}`);
  }

  // Log activity
  await logActivity(
    org.id,
    "repos_updated",
    `Repositories updated: ${reposAdded.length} added, ${reposRemoved.length} removed`,
    {
      installation_id: installationId,
      repos_added: reposAdded.map((r) => r.full_name),
      repos_removed: reposRemoved.map((r) => r.full_name),
    }
  );
}

function handlePush(payload: Record<string, unknown>) {
  const repoObj = payload.repository as Record<string, unknown>;
  const fullName = repoObj?.full_name as string;
  const ref = payload.ref as string;
  const defaultBranch = repoObj?.default_branch as string;

  // Only act on default branch pushes
  if (ref !== `refs/heads/${defaultBranch}`) return;

  const installation = payload.installation as Record<string, unknown>;
  const installationId = installation?.id as number;

  const commits = (payload.commits as Array<Record<string, unknown>>) ?? [];
  const changedFiles = new Set<string>();
  for (const commit of commits) {
    for (const f of (commit.added as string[]) ?? []) changedFiles.add(f);
    for (const f of (commit.modified as string[]) ?? []) changedFiles.add(f);
    for (const f of (commit.removed as string[]) ?? []) changedFiles.add(f);
  }

  // Only scan if relevant files changed
  const hasRelevantChanges = [...changedFiles].some(
    (f) => /\.(ts|tsx|js|jsx|mjs|mts|yml|yaml)$/.test(f)
  );

  if (!hasRelevantChanges) {
    console.log(`[push] ${fullName}: no relevant changes, skipping`);
    return;
  }

  // Don't scan our own PRs (avoid infinite loops)
  const headCommit = payload.head_commit as Record<string, unknown> | undefined;
  const commitMsg = (headCommit?.message as string) ?? "";
  if (commitMsg.startsWith("fix(console-cleanup)") ||
      commitMsg.startsWith("fix(unused-imports)") ||
      commitMsg.startsWith("fix(actions-updater)") ||
      commitMsg.startsWith("fix(dead-exports)") ||
      commitMsg.startsWith("fix(actions-security)") ||
      commitMsg.startsWith("security(secret-scanner)") ||
      commitMsg.startsWith("security(llm-security)") ||
      commitMsg.startsWith("docs(readme-generator)") ||
      commitMsg.startsWith("docs(architecture-mapper)") ||
      commitMsg.startsWith("docs(api-doc-generator)")) {
    console.log(`[push] ${fullName}: skipping — commit from nanobots`);
    return;
  }

  console.log(`[push] ${fullName}: ${changedFiles.size} files changed, triggering scan`);

  const [owner, name] = fullName.split("/");
  runAllNanobots(installationId, owner, name, { category: "security" }).then((prUrls) => {
    if (prUrls.length > 0) {
      console.log(`[push] ${fullName}: created ${prUrls.length} PRs`);
    }
  }).catch((err) => {
    console.error(`[push] ${fullName} scan failed:`, err);
  });
}

async function handleIssueComment(payload: Record<string, unknown>) {
  // Only handle new comments
  if (payload.action !== "created") return;

  const comment = payload.comment as Record<string, unknown>;
  const commentBody = comment.body as string;

  // Parse for @nanobots command
  const command = parseCommand(commentBody);
  if (!command) return;

  const issue = payload.issue as Record<string, unknown>;
  const repoObj = payload.repository as Record<string, unknown>;
  const installation = payload.installation as Record<string, unknown>;

  const issueNumber = issue.number as number;
  const fullName = repoObj.full_name as string;
  const [owner, repo] = fullName.split("/");
  const installationId = installation.id as number;
  const isPullRequest = !!issue.pull_request;

  console.log(`[webhook] @nanobots command: ${command.type} on ${fullName}#${issueNumber}`);

  const octokit = await getInstallationOctokit(installationId);

  handleCommand({
    command,
    octokit,
    owner,
    repo,
    issueNumber,
    isPullRequest,
  }).catch((err) => {
    console.error(`[webhook] agent error on ${fullName}#${issueNumber}:`, err);
  });
}
