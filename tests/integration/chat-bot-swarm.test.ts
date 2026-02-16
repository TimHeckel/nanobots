/**
 * Integration tests: Bot creation + swarm creation via chat tools.
 *
 * Runs against the real Neon database (same as the dev server).
 * Requires: DATABASE_URL in .env.local or environment.
 *
 * Run locally:
 *   npx vitest run --config vitest.config.integration.ts
 *
 * These tests exercise the full tool -> DB -> query round-trip:
 *   1. Create two bots via createBotToolDef
 *   2. Verify bots appear in listBots
 *   3. Create a swarm containing both bots
 *   4. Verify swarm appears in listSwarms
 *   5. Run manageSwarm to add/remove bots
 *   6. Clean up
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql, migrate } from "@/lib/db/index";
import { upsertUser } from "@/lib/db/queries/users";
import { createOrganization } from "@/lib/db/queries/organizations";
import { addMember } from "@/lib/db/queries/org-members";
import { createDefaultBotConfigs, getBotConfigs } from "@/lib/db/queries/bot-configs";

// Tool def factories — the actual chat tools
import { createBotToolDef } from "@/lib/chat/tools/create-bot";
import { promoteBotToolDef } from "@/lib/chat/tools/promote-bot";
import { createSwarmToolDef } from "@/lib/chat/tools/create-swarm";
import { listSwarmsToolDef } from "@/lib/chat/tools/list-swarms";
import { manageSwarmToolDef } from "@/lib/chat/tools/manage-swarm";
import { listWebhooksToolDef } from "@/lib/chat/tools/list-webhooks";
import { configureWebhookToolDef } from "@/lib/chat/tools/configure-webhook";

// Cleanup helpers
import { getSwarmByName } from "@/lib/db/queries/swarms";

// Helper: call tool.execute with non-null assertion (execute is always defined for our tools)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function exec(tool: { execute?: (...args: any[]) => any }, input: Record<string, unknown>) {
  return tool.execute!(input, { toolCallId: "test", messages: [] });
}

// Test fixture identifiers — use large numbers to avoid collisions with real data
const TEST_GITHUB_USER_ID = 99999001;
const TEST_GITHUB_ORG_ID = 99999002;
const TEST_INSTALLATION_ID = 99999003;

let testUserId: string;
let testOrgId: string;

describe("Bot + Swarm lifecycle via chat tools", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL not set. Run with: npx vitest run --config vitest.config.integration.ts"
      );
    }

    // Run migrations (idempotent — CREATE TABLE IF NOT EXISTS)
    await migrate();

    // Seed test user
    const user = await upsertUser({
      github_id: TEST_GITHUB_USER_ID,
      github_login: "test-bot-user",
      name: "Integration Test User",
      avatar_url: null,
    });
    testUserId = user.id;

    // Seed test org
    const org = await createOrganization({
      github_installation_id: TEST_INSTALLATION_ID,
      github_org_login: "test-bot-org",
      github_org_id: TEST_GITHUB_ORG_ID,
      name: "Test Bot Org",
      avatar_url: null,
    });
    testOrgId = org.id;

    // Link user to org
    await addMember({ org_id: testOrgId, user_id: testUserId, role: "admin" });

    // Seed default bot configs
    await createDefaultBotConfigs(testOrgId);
  });

  afterAll(async () => {
    // Clean up test bots from system_prompts + bot_configs
    await sql`DELETE FROM bot_configs WHERE org_id = ${testOrgId} AND bot_name LIKE 'test-%'`;
    await sql`DELETE FROM system_prompts WHERE org_id = ${testOrgId} AND agent_name LIKE 'test-%'`;

    // Clean up test swarms (cascade deletes swarm_bots)
    await sql`DELETE FROM swarms WHERE org_id = ${testOrgId}`;

    // Clean up test webhooks (cascade deletes deliveries)
    await sql`DELETE FROM webhook_endpoints WHERE org_id = ${testOrgId}`;

    // Clean up test activity
    await sql`DELETE FROM activity_log WHERE org_id = ${testOrgId}`;
  });

  // ---- Bot Creation ----

  it("creates a first bot (test-todo-finder)", async () => {
    const result = await exec(createBotToolDef(testOrgId, testUserId), {
      name: "test-todo-finder",
      description: "Finds TODO and FIXME comments in source code",
      category: "quality",
      systemPrompt:
        "You scan code for TODO, FIXME, HACK, and XXX comments. Report each with file, line, and the comment text.",
      fileExtensions: [".ts", ".js"],
    });

    expect(result).toMatchObject({
      success: true,
      bot: {
        name: "test-todo-finder",
        status: "draft",
        category: "quality",
      },
    });
  });

  it("creates a second bot (test-hardcoded-colors)", async () => {
    const result = await exec(createBotToolDef(testOrgId, testUserId), {
      name: "test-hardcoded-colors",
      description: "Finds hardcoded hex colors that should be CSS variables",
      category: "quality",
      systemPrompt:
        "You scan CSS, TSX, and JSX files for hardcoded hex color values (#fff, #1a2b3c, rgb()). Suggest using CSS custom properties instead.",
      fileExtensions: [".tsx", ".jsx", ".css"],
    });

    expect(result).toMatchObject({
      success: true,
      bot: {
        name: "test-hardcoded-colors",
        status: "draft",
        category: "quality",
      },
    });
  });

  it("both bots appear in bot_configs as disabled drafts", async () => {
    const configs = await getBotConfigs(testOrgId);
    const testBots = configs.filter((c) => c.bot_name.startsWith("test-"));

    expect(testBots).toHaveLength(2);
    expect(testBots.every((b) => b.enabled === false)).toBe(true);
  });

  // ---- Bot Promotion ----

  it("promotes test-todo-finder from draft to testing", async () => {
    const result = await exec(promoteBotToolDef(testOrgId, testUserId), {
      botName: "test-todo-finder",
    });

    expect(result).toMatchObject({
      success: true,
      fromStatus: "draft",
      toStatus: "testing",
    });
  });

  it("promotes test-todo-finder from testing to active (enables it)", async () => {
    const result = await exec(promoteBotToolDef(testOrgId, testUserId), {
      botName: "test-todo-finder",
    });

    expect(result).toMatchObject({
      success: true,
      fromStatus: "testing",
      toStatus: "active",
    });

    // Verify it's now enabled in bot_configs
    const configs = await getBotConfigs(testOrgId);
    const todoBot = configs.find((c) => c.bot_name === "test-todo-finder");
    expect(todoBot?.enabled).toBe(true);
  });

  it("rejects promoting an already-active bot", async () => {
    const result = await exec(promoteBotToolDef(testOrgId, testUserId), {
      botName: "test-todo-finder",
    });

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/already active/i);
  });

  // ---- Swarm Creation ----

  it("creates a swarm with both test bots", async () => {
    const result = await exec(createSwarmToolDef(testOrgId, testUserId), {
      name: "test-quality-suite",
      description: "Quality bots for integration testing",
      botNames: ["test-todo-finder", "test-hardcoded-colors"],
    });

    expect(result).toMatchObject({
      success: true,
      swarm: {
        name: "test-quality-suite",
        description: "Quality bots for integration testing",
        bots: ["test-todo-finder", "test-hardcoded-colors"],
      },
    });
  });

  it("swarm appears in listSwarms", async () => {
    const result = await exec(listSwarmsToolDef(testOrgId), {});

    const swarms = (result as { swarms: Array<{ name: string; botCount: number; bots: string[] }> }).swarms;
    const suite = swarms.find((s) => s.name === "test-quality-suite");

    expect(suite).toBeDefined();
    expect(suite!.botCount).toBe(2);
    expect(suite!.bots).toContain("test-todo-finder");
    expect(suite!.bots).toContain("test-hardcoded-colors");
  });

  it("rejects creating a duplicate swarm name", async () => {
    const result = await exec(createSwarmToolDef(testOrgId, testUserId), {
      name: "test-quality-suite",
      description: "Duplicate",
    });

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/already exists/i);
  });

  // ---- Swarm Management ----

  it("removes a bot from the swarm", async () => {
    const result = await exec(manageSwarmToolDef(testOrgId, testUserId), {
      swarmName: "test-quality-suite",
      action: "remove_bot",
      botName: "test-hardcoded-colors",
    });

    expect(result).toMatchObject({
      success: true,
      action: "remove_bot",
    });

    // Verify only 1 bot remains
    const swarm = await getSwarmByName(testOrgId, "test-quality-suite");
    expect(swarm!.bot_count).toBe(1);
    expect(swarm!.bot_names).toEqual(["test-todo-finder"]);
  });

  it("adds a bot back to the swarm", async () => {
    const result = await exec(manageSwarmToolDef(testOrgId, testUserId), {
      swarmName: "test-quality-suite",
      action: "add_bot",
      botName: "test-hardcoded-colors",
    });

    expect(result).toMatchObject({
      success: true,
      action: "add_bot",
    });

    const swarm = await getSwarmByName(testOrgId, "test-quality-suite");
    expect(swarm!.bot_count).toBe(2);
  });

  it("errors when managing a nonexistent swarm", async () => {
    const result = await exec(manageSwarmToolDef(testOrgId, testUserId), {
      swarmName: "nonexistent-swarm",
      action: "add_bot",
      botName: "test-todo-finder",
    });

    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toMatch(/not found/i);
  });

  // ---- Webhook Tools ----

  it("configures a webhook endpoint", async () => {
    const result = await exec(configureWebhookToolDef(testOrgId, testUserId), {
      url: "https://example.com/webhooks/nanobots",
      events: ["scan.completed", "bot.finding"],
      description: "Test webhook for integration tests",
    });

    const data = result as {
      success: boolean;
      secret: string;
      webhook: { id: string; url: string; events: string[] };
    };

    expect(data.success).toBe(true);
    expect(data.secret).toBeTruthy();
    expect(data.secret.length).toBe(64); // 32 bytes hex
    expect(data.webhook.url).toBe("https://example.com/webhooks/nanobots");
    expect(data.webhook.events).toEqual(["scan.completed", "bot.finding"]);
  });

  it("lists webhook endpoints", async () => {
    const result = await exec(listWebhooksToolDef(testOrgId), {});

    const data = result as { webhooks: Array<{ url: string; events: string[]; active: boolean }> };
    const testHook = data.webhooks.find((w) => w.url === "https://example.com/webhooks/nanobots");

    expect(testHook).toBeDefined();
    expect(testHook!.active).toBe(true);
    expect(testHook!.events).toContain("scan.completed");
  });

  // ---- Swarm Deletion ----

  it("deletes the swarm", async () => {
    const result = await exec(manageSwarmToolDef(testOrgId, testUserId), {
      swarmName: "test-quality-suite",
      action: "delete",
    });

    expect(result).toMatchObject({
      success: true,
      action: "delete",
    });

    // Verify gone
    const swarm = await getSwarmByName(testOrgId, "test-quality-suite");
    expect(swarm).toBeNull();
  });

  it("listSwarms returns empty after deletion", async () => {
    const result = await exec(listSwarmsToolDef(testOrgId), {});

    const data = result as { swarms: unknown[]; message?: string };
    const testSwarms = (data.swarms as Array<{ name: string }>).filter((s) =>
      s.name.startsWith("test-")
    );
    expect(testSwarms).toHaveLength(0);
  });
});
