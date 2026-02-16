import { describe, it, expect, vi } from "vitest";
import {
  instantiateTool,
  getAvailableHandlers,
} from "../../src/lib/nanobots/ai-bots/tool-library";
import type { ToolDefinition } from "../../src/lib/nanobots/ai-bots/types";

describe("ai-bots/tool-library", () => {
  describe("getAvailableHandlers()", () => {
    it("should return the built-in handler names", () => {
      const handlers = getAvailableHandlers();
      expect(handlers).toContain("fetch");
      expect(handlers).toContain("regex");
      expect(handlers).toContain("jsonpath");
      expect(handlers).toContain("transform");
    });
  });

  describe("instantiateTool()", () => {
    it("should throw for unknown implementation", () => {
      const def: ToolDefinition = {
        name: "bad-tool",
        description: "Won't work",
        parameters: {},
        implementation: "nonexistent",
      };
      expect(() => instantiateTool(def)).toThrow("Unknown tool implementation");
    });

    describe("regex handler", () => {
      it("should create a tool that matches regex patterns", async () => {
        const def: ToolDefinition = {
          name: "find-todos",
          description: "Find TODO comments",
          parameters: {
            content: { type: "string", description: "File content" },
          },
          implementation: "regex",
          implementationConfig: {
            pattern: "TODO:.+",
            flags: "g",
          },
        };

        const t = instantiateTool(def);
        expect(t).toBeDefined();
        expect(t.description).toBe("Find TODO comments");

        // Execute the tool directly
        const result = await t.execute(
          { content: "// TODO: fix this\n// TODO: refactor" },
          { toolCallId: "test", messages: [], abortSignal: new AbortController().signal },
        );
        expect(result).toEqual(["TODO: fix this", "TODO: refactor"]);
      });

      it("should return empty array for no matches", async () => {
        const def: ToolDefinition = {
          name: "find-todos",
          description: "Find TODOs",
          parameters: {
            content: { type: "string" },
          },
          implementation: "regex",
          implementationConfig: { pattern: "TODO:.+", flags: "g" },
        };

        const t = instantiateTool(def);
        const result = await t.execute(
          { content: "clean code" },
          { toolCallId: "test", messages: [], abortSignal: new AbortController().signal },
        );
        expect(result).toEqual([]);
      });
    });

    describe("jsonpath handler", () => {
      it("should extract values from JSON content", async () => {
        const def: ToolDefinition = {
          name: "extract-version",
          description: "Extract version from package.json",
          parameters: {
            content: { type: "string", description: "JSON content" },
          },
          implementation: "jsonpath",
          implementationConfig: {
            paths: ["version", "name"],
          },
        };

        const t = instantiateTool(def);
        const result = await t.execute(
          { content: JSON.stringify({ name: "my-app", version: "1.0.0" }) },
          { toolCallId: "test", messages: [], abortSignal: new AbortController().signal },
        );
        expect(result).toEqual({ version: "1.0.0", name: "my-app" });
      });

      it("should return undefined for missing paths", async () => {
        const def: ToolDefinition = {
          name: "extract",
          description: "Extract",
          parameters: { content: { type: "string" } },
          implementation: "jsonpath",
          implementationConfig: { paths: ["missing.field"] },
        };

        const t = instantiateTool(def);
        const result = await t.execute(
          { content: '{"other": 1}' },
          { toolCallId: "test", messages: [], abortSignal: new AbortController().signal },
        );
        expect(result).toEqual({ "missing.field": undefined });
      });

      it("should handle invalid JSON gracefully", async () => {
        const def: ToolDefinition = {
          name: "extract",
          description: "Extract",
          parameters: { content: { type: "string" } },
          implementation: "jsonpath",
          implementationConfig: { paths: ["a"] },
        };

        const t = instantiateTool(def);
        const result = await t.execute(
          { content: "not json" },
          { toolCallId: "test", messages: [], abortSignal: new AbortController().signal },
        );
        expect(result).toEqual({});
      });
    });

    describe("transform handler", () => {
      it("should split content by delimiter", async () => {
        const def: ToolDefinition = {
          name: "split-lines",
          description: "Split by comma",
          parameters: { content: { type: "string" } },
          implementation: "transform",
          implementationConfig: { operation: "split", delimiter: "," },
        };

        const t = instantiateTool(def);
        const result = await t.execute(
          { content: "a,b,c" },
          { toolCallId: "test", messages: [], abortSignal: new AbortController().signal },
        );
        expect(result).toEqual(["a", "b", "c"]);
      });

      it("should get non-empty lines", async () => {
        const def: ToolDefinition = {
          name: "get-lines",
          description: "Get lines",
          parameters: { content: { type: "string" } },
          implementation: "transform",
          implementationConfig: { operation: "lines" },
        };

        const t = instantiateTool(def);
        const result = await t.execute(
          { content: "line1\n\nline2\nline3\n" },
          { toolCallId: "test", messages: [], abortSignal: new AbortController().signal },
        );
        expect(result).toEqual(["line1", "line2", "line3"]);
      });

      it("should pass through for identity operation", async () => {
        const def: ToolDefinition = {
          name: "passthrough",
          description: "Pass through",
          parameters: { content: { type: "string" } },
          implementation: "transform",
          implementationConfig: {},
        };

        const t = instantiateTool(def);
        const result = await t.execute(
          { content: "hello" },
          { toolCallId: "test", messages: [], abortSignal: new AbortController().signal },
        );
        expect(result).toBe("hello");
      });
    });

    describe("fetch handler", () => {
      it("should create a tool with URL template interpolation", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          text: () => Promise.resolve("response data"),
        });
        vi.stubGlobal("fetch", mockFetch);

        const def: ToolDefinition = {
          name: "api-call",
          description: "Call API",
          parameters: {
            packageName: { type: "string" },
            version: { type: "string" },
          },
          implementation: "fetch",
          implementationConfig: {
            urlTemplate: "https://api.example.com/pkg/{packageName}/{version}",
          },
        };

        const t = instantiateTool(def);
        const result = await t.execute(
          { packageName: "lodash", version: "4.17.21" },
          { toolCallId: "test", messages: [], abortSignal: new AbortController().signal },
        );

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/pkg/lodash/4.17.21",
        );
        expect(result).toBe("response data");

        vi.unstubAllGlobals();
      });
    });

    describe("Zod schema generation", () => {
      it("should create proper schemas from parameter definitions", () => {
        const def: ToolDefinition = {
          name: "multi-param",
          description: "Multi param tool",
          parameters: {
            name: { type: "string", description: "Name" },
            count: { type: "number", description: "Count" },
            active: { type: "boolean" },
            tags: { type: "array" },
          },
          implementation: "transform",
        };

        // Should not throw — schema should be valid
        const t = instantiateTool(def);
        expect(t).toBeDefined();
      });
    });
  });
});
