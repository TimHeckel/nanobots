import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    surface: "operator-control-room",
    conversationContext: {
      evidenceSources: ["GitHub", "Screenshot Capture"],
      missingEvidence: ["Incident response walkthrough recording"],
      nextRecommendedAction: "Resolve Evidence Gap",
    },
  });
}
