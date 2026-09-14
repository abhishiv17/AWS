import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_MODEL = "amazon.nova-lite-v1:0";

function client() {
  return new BedrockRuntimeClient({
    region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION,
  });
}

export async function POST(request: Request) {
  const region = process.env.BEDROCK_REGION ?? process.env.AWS_REGION;
  const modelId = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL;
  if (!region) return NextResponse.json({ error: "Bedrock region is not configured" }, { status: 503 });

  try {
    const body = (await request.json()) as { role?: string };
    const role = body.role === "warden" ? "warden" : "evacuee";
    const command = new ConverseCommand({
      modelId,
      system: [{
        text: "You write concise authored dialogue for a serious campus evacuation training simulation. Never claim this is live emergency guidance. Use concrete sensory details and clear verbs. Return exactly four short lines, with no numbering, markdown, or preamble.",
      }],
      messages: [{
        role: "user",
        content: [{
        text: role === "warden"
          ? "Write a four-line briefing for the spectator warden. They watch an evacuee in a Science Block and Academic Block, verify evidence, communicate route information, and may intervene once. Make the warden feel like a calm operations lead."
            : "Write a four-line briefing for an evacuee starting in a central entrance corridor. Explain in plain language that movement is locked until the briefing ends. Then explain WASD to move, Space to jump, E to interact, the sequence of backpack, access card, two clues, gas valve, first-aid kit, and marked exit, and that threats are visible to the warden but not the evacuee.",
        }],
      }],
      inferenceConfig: { maxTokens: 220, temperature: 0.55 },
    });
    const response = await client().send(command);
    const text = (response.output?.message?.content ?? [])
      .flatMap((block) => ("text" in block && typeof block.text === "string" ? [block.text] : []))
      .join("\n")
      .trim();
    const lines = text.split(/\r?\n/).map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean).slice(0, 4);
    if (!lines.length) return NextResponse.json({ error: "Bedrock returned no dialogue" }, { status: 502 });
    return NextResponse.json({ lines });
  } catch (error) {
    console.error("Bedrock narration request failed", error);
    return NextResponse.json({ error: "Narration provider unavailable" }, { status: 503 });
  }
}
