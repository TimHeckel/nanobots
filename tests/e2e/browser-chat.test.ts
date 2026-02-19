/**
 * Browser E2E Tests for nanobots.sh Chat — Bot & Swarm Creation
 *
 * These tests hit real AI (OpenRouter) and a real database, so they are slow
 * (~30-60s per test) and non-deterministic. They run in the e2e workflow, not CI.
 *
 * Prerequisites:
 *   - App deployed at E2E_BASE_URL (default: http://localhost:6100)
 *   - DATABASE_URL, JWT_SECRET, OPENROUTER_API_KEY set
 *   - For CI: AGENT_BROWSER_PROVIDER=kernel and KERNEL_API_KEY
 *   - For local: npm run dev + HEADED=1 for visible browser
 *
 * NOTE: Tool-based tests (createBot, createSwarm, listSwarms) are skipped
 * because OpenRouter returns finishReason "stop" instead of "tool_calls" for
 * tool use responses, preventing the AI SDK from executing tools server-side.
 * The streaming text response works fine. Once the OpenRouter/AI SDK tool
 * execution issue is resolved, remove the .skip annotations.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { BrowserManager } from "agent-browser/dist/browser.js";
import {
  createBrowser,
  navigate,
  getTestUserFromDb,
  generateTestJwt,
  injectSessionCookie,
  sendChatMessage,
} from "./helpers";

describe("Chat — Bot Creation", () => {
  let browser: BrowserManager;
  let orgId: string;

  beforeAll(async () => {
    const user = await getTestUserFromDb();
    orgId = user.orgId;
    const token = await generateTestJwt({
      userId: user.userId,
      orgId: user.orgId,
      role: "admin",
    });

    browser = await createBrowser();
    await injectSessionCookie(browser, token);
    await navigate(browser, "/chat");

    // Wait for chat interface to load
    const page = browser.getPage();
    await page.waitForFunction(
      () =>
        !!document.querySelector(
          'textarea[placeholder="Ask nanobots anything..."]',
        ),
      { timeout: 15000 },
    );
  });

  afterAll(async () => {
    // Clean up test bot from DB
    try {
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        const sql = neon(dbUrl);
        await sql`DELETE FROM system_prompts WHERE org_id = ${orgId}::uuid AND agent_name = 'e2e-test-bot'`;
        await sql`DELETE FROM bot_configs WHERE org_id = ${orgId}::uuid AND bot_name = 'e2e-test-bot'`;
      }
    } catch {
      // best-effort cleanup
    }
    await browser?.close();
  });

  it("loads authenticated chat interface", async () => {
    const page = browser.getPage();
    const visible = await page.evaluate(
      () =>
        !!document.querySelector(
          'textarea[placeholder="Ask nanobots anything..."]',
        ),
    );
    expect(visible).toBe(true);
  });

  it("sends a message and receives AI response", async () => {
    await sendChatMessage(browser, "Say hello in one sentence");

    // Wait for the assistant response bubble to appear with text
    const page = browser.getPage();
    await page.waitForFunction(
      () => {
        const bubbles = document.querySelectorAll(".whitespace-pre-wrap");
        // First bubble = user message, second = assistant response
        return bubbles.length >= 2 && (bubbles[1]?.textContent?.length ?? 0) > 5;
      },
      { timeout: 45000 },
    );

    const responseText = await page.evaluate(
      () => document.querySelectorAll(".whitespace-pre-wrap")[1]?.textContent ?? "",
    );
    expect(responseText.length).toBeGreaterThan(5);
  });

  // Skipped: OpenRouter returns finishReason "stop" for tool calls, preventing
  // server-side tool execution. The createBot tool input streams correctly but
  // the tool never runs. See: AI SDK + OpenRouter tool calling compatibility.
  it.skip("creates a bot through conversation", async () => {
    await sendChatMessage(
      browser,
      "Create a security bot called e2e-test-bot that finds hardcoded passwords in source files. Category: security.",
    );

    const page = browser.getPage();
    await page.waitForFunction(
      () => {
        const text = document.body.innerText.toLowerCase();
        return text.includes("e2e-test-bot") && text.includes("created");
      },
      { timeout: 90000 },
    );

    const snap = await browser.getSnapshot();
    expect(snap.tree).toMatch(/e2e-test-bot/i);
  });
});

describe("Chat — Swarm Creation", () => {
  let browser: BrowserManager;
  let orgId: string;

  beforeAll(async () => {
    const user = await getTestUserFromDb();
    orgId = user.orgId;
    const token = await generateTestJwt({
      userId: user.userId,
      orgId: user.orgId,
      role: "admin",
    });

    browser = await createBrowser();
    await injectSessionCookie(browser, token);
    await navigate(browser, "/chat");

    const page = browser.getPage();
    await page.waitForFunction(
      () =>
        !!document.querySelector(
          'textarea[placeholder="Ask nanobots anything..."]',
        ),
      { timeout: 15000 },
    );
  });

  afterAll(async () => {
    // Clean up test swarm from DB
    try {
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        const sql = neon(dbUrl);
        await sql`DELETE FROM swarm_bots WHERE swarm_id IN (SELECT id FROM swarms WHERE org_id = ${orgId}::uuid AND name = 'e2e-test-swarm')`;
        await sql`DELETE FROM swarms WHERE org_id = ${orgId}::uuid AND name = 'e2e-test-swarm'`;
      }
    } catch {
      // best-effort cleanup
    }
    await browser?.close();
  });

  // Skipped: Same OpenRouter tool calling issue as createBot above.
  it.skip("creates a swarm through conversation", async () => {
    await sendChatMessage(
      browser,
      "Create a swarm called e2e-test-swarm with description 'E2E test swarm' and include console-cleanup and unused-imports bots",
    );

    const page = browser.getPage();
    await page.waitForFunction(
      () => {
        const text = document.body.innerText.toLowerCase();
        return (
          text.includes("e2e-test-swarm") &&
          (text.includes("created") || text.includes("\u2713"))
        );
      },
      { timeout: 90000 },
    );

    const snap = await browser.getSnapshot();
    expect(snap.tree).toMatch(/e2e-test-swarm/i);
  });

  // Skipped: Depends on createSwarm working (same tool calling issue).
  it.skip("lists swarms", async () => {
    await sendChatMessage(browser, "Show me all swarms");

    const page = browser.getPage();
    await page.waitForFunction(
      () => document.body.innerText.toLowerCase().includes("e2e-test-swarm"),
      { timeout: 45000 },
    );

    const snap = await browser.getSnapshot();
    expect(snap.tree).toMatch(/e2e-test-swarm/i);
  });
});
