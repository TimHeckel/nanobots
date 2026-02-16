import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "./types";

type ZodShape = Record<string, z.ZodType>;

function buildZodSchema(
  parameters: Record<string, { type: string; description?: string }>,
): z.ZodObject<ZodShape> {
  const shape: ZodShape = {};

  for (const [key, def] of Object.entries(parameters)) {
    let schema: z.ZodType;
    switch (def.type) {
      case "number":
        schema = z.number();
        break;
      case "boolean":
        schema = z.boolean();
        break;
      case "array":
        schema = z.array(z.string());
        break;
      default:
        schema = z.string();
    }
    if (def.description) {
      schema = schema.describe(def.description);
    }
    shape[key] = schema;
  }

  return z.object(shape);
}

function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

const TOOL_HANDLERS: Record<
  string,
  (config: Record<string, unknown>) => (params: Record<string, unknown>) => unknown
> = {
  fetch: (config) => async (params) => {
    const url = interpolate(
      (config.urlTemplate as string) ?? "",
      params as Record<string, string>,
    );
    const res = await globalThis.fetch(url);
    return res.text();
  },

  regex: (config) => (params) => {
    const re = new RegExp(
      (config.pattern as string) ?? "",
      (config.flags as string) ?? "g",
    );
    const content = String(params.content ?? "");
    return [...content.matchAll(re)].map((m) => m[0]);
  },

  jsonpath: (config) => (params) => {
    const content = String(params.content ?? "");
    const paths = (config.paths as string[]) ?? [];
    try {
      const obj = JSON.parse(content);
      return paths.reduce<Record<string, unknown>>((acc, path) => {
        const keys = path.split(".");
        let val: unknown = obj;
        for (const k of keys) {
          if (val && typeof val === "object" && k in val) {
            val = (val as Record<string, unknown>)[k];
          } else {
            val = undefined;
            break;
          }
        }
        acc[path] = val;
        return acc;
      }, {});
    } catch {
      return {};
    }
  },

  transform: (config) => (params) => {
    const operation = (config.operation as string) ?? "identity";
    const content = params.content;
    if (operation === "split") {
      return String(content ?? "").split((config.delimiter as string) ?? "\n");
    }
    if (operation === "lines") {
      return String(content ?? "").split("\n").filter(Boolean);
    }
    return content;
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function instantiateTool(def: ToolDefinition): any {
  const handlerFactory = TOOL_HANDLERS[def.implementation];
  if (!handlerFactory) {
    throw new Error(`Unknown tool implementation: ${def.implementation}`);
  }
  const handler = handlerFactory(def.implementationConfig ?? {});
  const schema = buildZodSchema(def.parameters);

  return tool({
    description: def.description,
    inputSchema: schema,
    execute: async (params: Record<string, unknown>) => handler(params),
  });
}

export function getAvailableHandlers(): string[] {
  return Object.keys(TOOL_HANDLERS);
}
