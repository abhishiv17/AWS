import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

export type Participant = {
  id: string;
  name: string;
  role: string | null;
  sectorId: string | null;
  joinedAt: number;
  connected?: boolean;
  reconnectUntil?: number | null;
};

export type EvidenceRecord = {
  id: string;
  sectorId: string;
  label: string;
  source: string;
  status: string;
  observedAt: number | null;
  verifiedAt: number | null;
  updatedAt: number;
  nextAction: string;
};

export type RouteMessage = {
  messageId: string;
  drillId: string;
  senderId: string;
  senderSector: string;
  targetSector: string;
  direction: string;
  kind: string;
  confidence: string;
  urgency: string;
  createdAt: number;
  expiresAt: number;
  caption: string;
  acknowledgedAt: number | null;
};

export type DrillRoom = {
  drillId: string;
  code: string;
  hostId: string;
  maxPlayers: number;
  phase: string;
  startsAt: number | null;
  participants: Participant[];
  createdAt: number;
  scenarioVersion: string;
  seed: number;
  outcome: string | null;
};

export type StoredRoom = DrillRoom & {
  pk: string;
  sk: string;
  recordType: "META";
  stateVersion: number;
  eventSequence: number;
  routeStatus: "clear" | "unsafe" | "intervened";
  interventionApplied: boolean;
  evidence: EvidenceRecord[];
  latestMessage: RouteMessage | null;
};

export type AppSyncEvent = {
  info?: { fieldName?: string };
  arguments?: Record<string, unknown>;
  identity?: { sub?: string };
};

export type EventRecord = {
  drillId: string;
  eventId: string;
  sequence: number;
  eventType: string;
  actorRole: string | null;
  actorId: string | null;
  sectorId: string | null;
  payload: unknown;
  serverTime: number;
};

export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export function tableName() {
  const value = process.env.TABLE_NAME;
  if (!value) throw new Error("TABLE_NAME is not configured");
  return value;
}

/** The browser contract uses epoch milliseconds for all temporal fields. */
export const now = () => Date.now();

export const roomKey = (code: string) => ({ pk: `ROOM#${code}`, sk: "META" });

export function publicRoom(room: StoredRoom): DrillRoom {
  return {
    drillId: room.drillId,
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    phase: room.phase,
    startsAt: room.startsAt,
    participants: room.participants,
    createdAt: room.createdAt,
    scenarioVersion: room.scenarioVersion,
    seed: room.seed,
    outcome: room.outcome,
  };
}

export async function getRoomByCode(code: string) {
  const result = await db.send(
    new GetCommand({ TableName: tableName(), Key: roomKey(code) }),
  );
  return (result.Item as StoredRoom | undefined) ?? null;
}

export async function getRoomByDrillId(drillId: string) {
  const result = await db.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: "ByDrillId",
      KeyConditionExpression: "#drillId = :drillId AND #recordType = :recordType",
      ExpressionAttributeNames: { "#drillId": "drillId", "#recordType": "recordType" },
      ExpressionAttributeValues: { ":drillId": drillId, ":recordType": "META" },
      Limit: 1,
    }),
  );
  return (result.Items?.[0] as StoredRoom | undefined) ?? null;
}

export async function saveRoom(room: StoredRoom) {
  await db.send(
    new PutCommand({
      TableName: tableName(),
      Item: room,
    }),
  );
}

export async function appendEvent(room: StoredRoom, event: EventRecord) {
  await db.send(
    new PutCommand({
      TableName: tableName(),
      Item: {
        pk: room.pk,
        sk: `EVENT#${String(event.sequence).padStart(8, "0")}`,
        recordType: "EVENT",
        ...event,
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    }),
  );
}

export const eventId = (room: StoredRoom, sequence: number) =>
  `${room.drillId}:event:${sequence}`;

export function actorId(event: AppSyncEvent, fallback?: unknown) {
  if (event.identity?.sub) return event.identity.sub;
  return typeof fallback === "string" && fallback ? fallback : "anonymous";
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
