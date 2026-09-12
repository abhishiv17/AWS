import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { AppSyncEvent, EventRecord } from "./shared";
import { db, getRoomByDrillId, now, tableName } from "./shared";

function answerFor(outcome: string | null, safe: boolean | null) {
  if (safe === true) return "Yes. The evacuee reached the authored assembly point.";
  if (safe === false) return "No. The drill ended before a safe assembly confirmation.";
  return outcome === "participant-left" ? "Incomplete. A participant disconnected." : "Pending. The drill has no recorded outcome.";
}

export async function handler(event: AppSyncEvent) {
  const drillId = typeof event.arguments?.drillId === "string" ? event.arguments.drillId : "";
  const room = await getRoomByDrillId(drillId);
  if (!room) return null;

  const result = await db.send(
    new QueryCommand({
      TableName: tableName(),
      KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :event)",
      ExpressionAttributeNames: { "#pk": "pk", "#sk": "sk" },
      ExpressionAttributeValues: { ":pk": room.pk, ":event": "EVENT#" },
      ScanIndexForward: true,
    }),
  );
  const events = (result.Items ?? []) as EventRecord[];
  const hasAssembly = events.some((item) => item.eventType === "assembly_confirmed");
  const hasFailure = events.some((item) => item.eventType === "drill_failed");
  const safe = hasAssembly ? true : hasFailure || room.outcome === "participant-left" ? false : null;
  const verified = events.some((item) => item.eventType === "verify_east_route");
  const communicated = events.some((item) => item.eventType === "send_west_route");
  const status = safe === null ? "incomplete" : "complete";
  const score = safe === null ? null : safe && verified && communicated ? 100 : safe ? 70 : 20;

  return {
    drillId: room.drillId,
    scenarioVersion: room.scenarioVersion,
    rulesVersion: process.env.RULES_VERSION ?? "score-v1",
    outcome: room.outcome ?? (safe === true ? "assembly-confirmed" : safe === false ? "drill-failed" : "pending"),
    coordinationScore: score,
    status,
    answers: {
      safeEvacuation: answerFor(room.outcome, safe),
      coordinationFailure: verified ? (communicated ? "No major verification or communication gap recorded." : "The route was verified, but no alternate route message was recorded.") : "Evidence was not verified before the recorded outcome.",
      nextPractice: verified && communicated ? "Replay with a shorter verification-to-message delay." : "Replay after observing and verifying the route evidence before messaging.",
    },
    metrics: {
      decisionDelayMs: null,
      verificationDelayMs: null,
      communicationDelayMs: null,
      usefulMessageRate: communicated ? 1 : 0,
      exposureBucket: "not yet calculated",
      routeDeviation: "not yet calculated",
    },
    insights: [
      {
        code: verified ? "verification-recorded" : "verification-missing",
        explanation: verified ? "The event ledger contains a verified evidence transition." : "The event ledger contains no verified evidence transition.",
      },
    ],
    replayRecommendation: verified && communicated ? "Replay after verifying before messaging." : "Replay with an explicit evidence verification step.",
    generatedAt: now(),
  };
}
