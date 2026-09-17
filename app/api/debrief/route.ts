import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { NextResponse } from "next/server";
import type { SimulationReport } from "../../simulation/core/report";

export const runtime = "nodejs";

const DEFAULT_MODEL = "amazon.nova-lite-v1:0";

function client() {
  return new BedrockRuntimeClient({
    region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION,
  });
}

interface DebriefRequest {
  report?: unknown;
}

function isSimulationReport(value: unknown): value is SimulationReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<SimulationReport>;
  const metrics = report.metrics;
  return Boolean(
    typeof report.runId === "string" &&
      typeof report.scenarioId === "string" &&
      typeof report.scenarioVersion === "string" &&
      typeof report.seed === "number" &&
      typeof report.outcome === "string" &&
      typeof report.generatedAtTick === "number" &&
      metrics &&
      typeof metrics.elapsedSeconds === "number" &&
      typeof metrics.eventCount === "number" &&
      metrics.accountability &&
      typeof metrics.accountability.total === "number" &&
      typeof metrics.accountability.assembled === "number" &&
      typeof metrics.accountability.missing === "number" &&
      Array.isArray(report.findings) &&
      Array.isArray(report.limitations),
  );
}

export async function POST(request: Request) {
  const region = process.env.BEDROCK_REGION ?? process.env.AWS_REGION;
  const modelId = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL;
  if (!region) {
    return NextResponse.json({ error: "Bedrock region is not configured" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as DebriefRequest;
    if (!isSimulationReport(body.report)) {
      return NextResponse.json({ error: "A valid simulation report is required" }, { status: 400 });
    }
    const report = body.report;
    const metrics = report.metrics;
    const evidence = {
      runId: report.runId,
      scenario: `${report.scenarioId}@${report.scenarioVersion}`,
      seed: report.seed,
      outcome: report.outcome,
      generatedAtTick: report.generatedAtTick,
      elapsedSeconds: metrics.elapsedSeconds,
      eventCount: metrics.eventCount,
      accountability: metrics.accountability,
      assistanceRequests: metrics.assistanceRequests,
      injuryTransitions: metrics.injuryTransitions,
      routeChanges: metrics.routeChanges,
      blockedConnectorChanges: metrics.blockedConnectorChanges,
      timing: metrics.timing,
      exitUtilization: metrics.exitUtilization,
      congestion: metrics.congestion,
      exposure: metrics.exposure,
      findings: report.findings,
      limitations: report.limitations,
    };
    const prompt = `Analyze this campus evacuation simulation using only the measured and logged evidence in the JSON below:

${JSON.stringify(evidence)}

Write a concise 2-3 sentence performance analysis. State what the recorded outcome supports, cite concrete measured values or finding statements, and say when a metric is unavailable. Do not infer causes that are not recorded, invent safety conclusions, or add regulatory advice. This appears on a training results screen.`;

    const command = new ConverseCommand({
      modelId,
      system: [{
        text: "You are a simulation debrief instructor. Use only the provided measured or logged evidence, state unavailable metrics plainly, and never invent causes, physical claims, regulatory conclusions, or unrecorded outcomes. Be direct and constructive. Never use bullet points or markdown formatting.",
      }],
      messages: [{
        role: "user",
        content: [{ text: prompt }],
      }],
      inferenceConfig: { maxTokens: 150, temperature: 0.4 },
    });

    const response = await client().send(command);
    const text = (response.output?.message?.content ?? [])
      .flatMap((block) => ("text" in block && typeof block.text === "string" ? [block.text] : []))
      .join(" ")
      .trim();

    if (!text) {
      return NextResponse.json({ error: "Bedrock returned no analysis" }, { status: 502 });
    }

    return NextResponse.json({ analysis: text, provider: "bedrock" });
  } catch (error) {
    console.error("Bedrock debrief request failed", error);
    return NextResponse.json({ error: "Debrief provider unavailable" }, { status: 503 });
  }
}
