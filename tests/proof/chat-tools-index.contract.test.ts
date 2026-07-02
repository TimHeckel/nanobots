import { describe, expect, it } from "vitest";
import * as chatTools from "@/lib/chat/tools";
import {
  approveProposalToolDef,
  completeOnboardingToolDef,
  connectEvidenceSourceToolDef,
  configureWebhookToolDef,
  createBotToolDef,
  createSwarmToolDef,
  docStatusToolDef,
  editSystemPromptToolDef,
  generateDocsToolDef,
  inspectControlGapsToolDef,
  resolveControlGapToolDef,
  syncEvidenceSourceToolDef,
} from "@/lib/chat/tools";

describe("chat tools barrel contract", () => {
  it("exports the minimal control-room tool surface", () => {
    expect(Object.keys(chatTools).sort()).toEqual([
      "approveProposalToolDef",
      "completeOnboardingToolDef",
      "configureWebhookToolDef",
      "connectEvidenceSourceToolDef",
      "createBotToolDef",
      "createSwarmToolDef",
      "docStatusToolDef",
      "editSystemPromptToolDef",
      "generateDocsToolDef",
      "inspectControlGapsToolDef",
      "resolveControlGapToolDef",
      "syncEvidenceSourceToolDef",
    ]);

    expect(typeof chatTools.approveProposalToolDef).toBe("function");
    expect(typeof chatTools.completeOnboardingToolDef).toBe("function");
    expect(typeof chatTools.connectEvidenceSourceToolDef).toBe("function");
    expect(typeof chatTools.configureWebhookToolDef).toBe("function");
    expect(typeof chatTools.createBotToolDef).toBe("function");
    expect(typeof chatTools.createSwarmToolDef).toBe("function");
    expect(typeof chatTools.docStatusToolDef).toBe("function");
    expect(typeof chatTools.editSystemPromptToolDef).toBe("function");
    expect(typeof chatTools.generateDocsToolDef).toBe("function");
    expect(typeof chatTools.inspectControlGapsToolDef).toBe("function");
    expect(typeof chatTools.resolveControlGapToolDef).toBe("function");
    expect(typeof chatTools.syncEvidenceSourceToolDef).toBe("function");

    expect(chatTools.approveProposalToolDef).toBe(approveProposalToolDef);
    expect(chatTools.completeOnboardingToolDef).toBe(completeOnboardingToolDef);
    expect(chatTools.connectEvidenceSourceToolDef).toBe(connectEvidenceSourceToolDef);
    expect(chatTools.configureWebhookToolDef).toBe(configureWebhookToolDef);
    expect(chatTools.createBotToolDef).toBe(createBotToolDef);
    expect(chatTools.createSwarmToolDef).toBe(createSwarmToolDef);
    expect(chatTools.docStatusToolDef).toBe(docStatusToolDef);
    expect(chatTools.editSystemPromptToolDef).toBe(editSystemPromptToolDef);
    expect(chatTools.generateDocsToolDef).toBe(generateDocsToolDef);
    expect(chatTools.inspectControlGapsToolDef).toBe(inspectControlGapsToolDef);
    expect(chatTools.resolveControlGapToolDef).toBe(resolveControlGapToolDef);
    expect(chatTools.syncEvidenceSourceToolDef).toBe(syncEvidenceSourceToolDef);
  });
});
