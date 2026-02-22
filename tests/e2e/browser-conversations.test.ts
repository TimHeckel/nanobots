/**
 * Browser E2E Tests for Chat Conversation Persistence
 *
 * Tests that conversations are created, messages persist, and history
 * reloads correctly from the sidebar and via URL routing (/chat/[id]).
 *
 * Prerequisites:
 *   - App deployed at E2E_BASE_URL (default: http://localhost:6100)
 *   - DATABASE_URL, JWT_SECRET, OPENROUTER_API_KEY set
 *   - For CI: AGENT_BROWSER_PROVIDER=kernel and KERNEL_API_KEY
 *   - For local: npm run dev + HEADED=1 for visible browser
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
  getBaseUrl,
} from "./helpers";

describe("Chat — Conversation Persistence", () => {
  let browser: BrowserManager;
  let userId: string;
  let orgId: string;
  const createdConversationIds: string[] = [];

  beforeAll(async () => {
    const user = await getTestUserFromDb();
    userId = user.userId;
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
    // Clean up test conversations from DB
    try {
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl && createdConversationIds.length > 0) {
        const sql = neon(dbUrl);
        for (const id of createdConversationIds) {
          await sql`DELETE FROM chat_messages WHERE conversation_id = ${id}`;
          await sql`DELETE FROM conversations WHERE id = ${id}`;
        }
      }
    } catch {
      // best-effort cleanup
    }
    await browser?.close();
  });

  it("auto-creates a conversation on first message", async () => {
    const uniqueMsg = `e2e-convo-test-${Date.now()}`;
    await sendChatMessage(browser, uniqueMsg);

    const page = browser.getPage();

    // Wait for URL to update to /chat/<id>
    await page.waitForFunction(
      () => window.location.pathname.startsWith("/chat/") && window.location.pathname !== "/chat",
      { timeout: 30000 },
    );

    const url = await page.evaluate(() => window.location.pathname);
    const convId = url.replace("/chat/", "");
    expect(convId.length).toBeGreaterThanOrEqual(4);
    createdConversationIds.push(convId);

    // Wait for assistant response
    await page.waitForFunction(
      () => {
        const bubbles = document.querySelectorAll(".whitespace-pre-wrap");
        return bubbles.length >= 2 && (bubbles[1]?.textContent?.length ?? 0) > 2;
      },
      { timeout: 60000 },
    );

    // Conversation should appear in sidebar
    const sidebarText = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="w-72"]');
      return sidebar?.textContent ?? "";
    });
    expect(sidebarText).toContain(uniqueMsg.slice(0, 20));
  });

  it("persists conversation after page reload", async () => {
    // We should have a conversation from the previous test
    expect(createdConversationIds.length).toBeGreaterThanOrEqual(1);
    const convId = createdConversationIds[0];

    // Navigate directly to the conversation URL
    await navigate(browser, `/chat/${convId}`);

    const page = browser.getPage();

    // Wait for messages to load
    await page.waitForFunction(
      () => {
        const bubbles = document.querySelectorAll(".whitespace-pre-wrap");
        return bubbles.length >= 2;
      },
      { timeout: 30000 },
    );

    // Should have at least user message + assistant response
    const messageCount = await page.evaluate(
      () => document.querySelectorAll(".whitespace-pre-wrap").length,
    );
    expect(messageCount).toBeGreaterThanOrEqual(2);

    // First message should contain our unique test string
    const firstMsgText = await page.evaluate(
      () => document.querySelectorAll(".whitespace-pre-wrap")[0]?.textContent ?? "",
    );
    expect(firstMsgText).toContain("e2e-convo-test-");
  });

  it("creates a second conversation and switches between them", async () => {
    // Start a new chat
    const page = browser.getPage();

    // Click "New Chat" in sidebar
    await page.waitForFunction(
      () => !!document.querySelector('button'),
      { timeout: 10000 },
    );
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const newChatBtn = buttons.find((b) => b.textContent?.includes("New Chat"));
      if (newChatBtn) {
        newChatBtn.click();
        return true;
      }
      return false;
    });
    expect(clicked).toBe(true);

    // Wait for /chat page (no ID)
    await page.waitForFunction(
      () => window.location.pathname === "/chat",
      { timeout: 10000 },
    );

    // Wait for textarea to be ready
    await page.waitForFunction(
      () => {
        const el = document.querySelector(
          'textarea[placeholder="Ask nanobots anything..."]',
        ) as HTMLTextAreaElement | null;
        return el && !el.disabled;
      },
      { timeout: 30000 },
    );

    // Send a message in the new conversation
    const secondMsg = `e2e-second-convo-${Date.now()}`;
    await sendChatMessage(browser, secondMsg);

    // Wait for URL to update to /chat/<new-id>
    await page.waitForFunction(
      () => window.location.pathname.startsWith("/chat/") && window.location.pathname !== "/chat",
      { timeout: 30000 },
    );

    const url2 = await page.evaluate(() => window.location.pathname);
    const convId2 = url2.replace("/chat/", "");
    expect(convId2).not.toBe(createdConversationIds[0]);
    createdConversationIds.push(convId2);

    // Wait for assistant response
    await page.waitForFunction(
      () => {
        const bubbles = document.querySelectorAll(".whitespace-pre-wrap");
        return bubbles.length >= 2 && (bubbles[1]?.textContent?.length ?? 0) > 2;
      },
      { timeout: 60000 },
    );

    // Now switch back to first conversation via sidebar
    const firstConvId = createdConversationIds[0];
    const switchedBack = await page.evaluate(() => {
      // Find conversation buttons in sidebar
      const buttons = Array.from(document.querySelectorAll("button"));
      const convBtn = buttons.find((b) => {
        const parent = b.closest('[class*="group relative"]');
        return parent && b.textContent?.includes("e2e-convo-test-");
      });
      if (convBtn) {
        convBtn.click();
        return true;
      }
      return false;
    });
    expect(switchedBack).toBe(true);

    // Wait for navigation to first conversation
    await page.waitForFunction(
      `window.location.pathname === '/chat/${firstConvId}'`,
      { timeout: 15000 },
    );

    // Wait for messages to load — should show the first conversation's messages
    await page.waitForFunction(
      () => {
        const bubbles = document.querySelectorAll(".whitespace-pre-wrap");
        return bubbles.length >= 2;
      },
      { timeout: 30000 },
    );

    const firstMsgText = await page.evaluate(
      () => document.querySelectorAll(".whitespace-pre-wrap")[0]?.textContent ?? "",
    );
    expect(firstMsgText).toContain("e2e-convo-test-");
    // Should NOT contain the second conversation's message
    expect(firstMsgText).not.toContain("e2e-second-convo-");
  });

  it("deletes a conversation", async () => {
    // We should have 2 conversations
    expect(createdConversationIds.length).toBeGreaterThanOrEqual(2);

    const page = browser.getPage();

    // Count conversations in sidebar before delete
    const beforeCount = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="group relative"]');
      return items.length;
    });

    // Hover over the second conversation to reveal delete button, then click it
    const deleted = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="group relative"]');
      for (const item of items) {
        if (item.textContent?.includes("e2e-second-convo-")) {
          // Find the delete (X) button within this item
          const deleteBtn = item.querySelector('button:last-child');
          if (deleteBtn && deleteBtn !== item.querySelector('button:first-child')) {
            (deleteBtn as HTMLElement).click();
            return true;
          }
        }
      }
      return false;
    });
    expect(deleted).toBe(true);

    // Wait for the conversation to disappear from sidebar
    await page.waitForFunction(
      `!document.body.innerText.includes('e2e-second-convo-')`,
      { timeout: 10000 },
    );

    // Count should be one less
    const afterCount = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="group relative"]');
      return items.length;
    });
    expect(afterCount).toBeLessThan(beforeCount);

    // Remove from our tracking since it's been deleted
    createdConversationIds.pop();
  });
});
