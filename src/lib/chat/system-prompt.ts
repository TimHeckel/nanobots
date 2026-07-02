import type { Organization } from "@/lib/db/schema";
import type { OrgContext } from "./context";

export async function buildSystemPrompt(
  org: Organization,
  _context: OrgContext,
): Promise<string> {
  return `Operator Control Room for ${org.name}`;
}
