import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { AppSyncEvent } from "./shared";
import { asRecord, numberValue, stringValue } from "./shared";

const FALLBACK = {
  scenarioVersion: "campus-block-v1",
  seed: 18421,
  smokeOriginSector: "utility-control",
  blockedRoute: "east-route",
  smokeIntensity: 0.55,
  intervention: "ventilation-override",
  briefing: "Confirm the east route before sending the evacuee there.",
  fallback: true,
};

function validScenario(value: unknown) {
  const input = asRecord(value);
  const smokeIntensity = numberValue(input.smokeIntensity, -1);
  return (
    typeof input.scenarioVersion === "string" &&
    Number.isInteger(input.seed) &&
    input.smokeOriginSector === "utility-control" &&
    input.blockedRoute === "east-route" &&
    smokeIntensity >= 0 &&
    smokeIntensity <= 0.75 &&
    input.intervention === "ventilation-override" &&
    typeof input.briefing === "string"
  );
}

async function propose() {
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) return null;
  const client = new BedrockRuntimeClient({});
  const response = await client.send(
    new ConverseCommand({
      modelId,
      system: [
        {
          text: "Return JSON only. Keep every value within the supplied CampusEvac scenario enums and intensity bounds.",
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              text: JSON.stringify({
                scenarioVersion: "campus-block-v1",
                seed: 18421,
                smokeOriginSector: "utility-control",
                blockedRoute: "east-route",
                smokeIntensity: "0.0 to 0.75",
                intervention: "ventilation-override",
                briefing: "short training instruction",
              }),
            },
          ],
        },
      ],
      inferenceConfig: { maxTokens: 300, temperature: 0 },
    }),
  );
  const text = response.output?.message?.content?.find(
    (block) => "text" in block && typeof block.text === "string",
  );
  if (!text || !("text" in text)) return null;
  try {
    const candidate: unknown = JSON.parse(text.text);
    return validScenario(candidate) ? { ...asRecord(candidate), fallback: false } : null;
  } catch {
    return null;
  }
}

export async function handler(event: AppSyncEvent) {
  const input = asRecord(event.arguments?.input);
  try {
    const proposed = await propose();
    if (proposed) return proposed;
  } catch {
    // The authored seed is the explicit provider fallback.
  }
  return {
    ...FALLBACK,
    seed: numberValue(input.seed, FALLBACK.seed),
    scenarioVersion: stringValue(input.scenarioVersion, FALLBACK.scenarioVersion),
  };
}
