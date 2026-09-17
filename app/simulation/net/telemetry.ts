import type { RoomId } from "../level";
import type { RouteMessage } from "./types";

export const TELEMETRY_SCHEMA_VERSION = 1 as const;

export type TelemetryActorKind = "guide" | "navigator" | "system";

export type TelemetryDetails =
  | {
      type: "GUIDE_WARNING_SENT";
      messageId: string;
      direction: string;
      targetSector: RoomId;
      confidence: "observed" | "verified";
    }
  | {
      type: "GUIDE_WARNING_ACKNOWLEDGED";
      messageId: string;
      acknowledgedAt: number;
    }
  | {
      type: "VENTILATION_ACTIVATED";
      interventionId: string;
      active: true;
    }
  | {
      type: "MAYA_ASSISTANCE_REQUESTED";
      messageId: string;
      occupantId: string;
      roomId: RoomId;
      status: string;
    }
  | {
      type: "MAYA_ASSISTANCE_ACKNOWLEDGED";
      messageId: string;
      occupantId: string;
      acknowledgedAt: number;
    };

export type TelemetryEvent = {
  schemaVersion: typeof TELEMETRY_SCHEMA_VERSION;
  drillId: string;
  runId: string;
  sequence: number;
  tick: number;
  at: number;
  actorId: string;
  actorKind: TelemetryActorKind;
} & TelemetryDetails;

export interface TelemetryDelta {
  cursor: number;
  events: TelemetryEvent[];
}

export interface TelemetryContext {
  drillId: string;
  runId: string;
  tick: number;
  at: number;
  actorId: string;
  actorKind: TelemetryActorKind;
}

export function createTelemetryEvent(
  sequence: number,
  context: TelemetryContext,
  details: TelemetryDetails,
): TelemetryEvent {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Telemetry sequence must be a positive integer");
  }
  if (!Number.isInteger(context.tick) || context.tick < 0) {
    throw new Error("Telemetry tick must be a non-negative integer");
  }
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    sequence,
    ...context,
    ...details,
  } as TelemetryEvent;
}

export function appendTelemetryEvent(
  events: TelemetryEvent[],
  nextSequence: number,
  context: TelemetryContext,
  details: TelemetryDetails,
): { events: TelemetryEvent[]; event: TelemetryEvent; nextSequence: number } {
  const event = createTelemetryEvent(nextSequence, context, details);
  return {
    events: [...events, event],
    event,
    nextSequence: nextSequence + 1,
  };
}

export function telemetryDelta(events: TelemetryEvent[], cursor: number): TelemetryDelta {
  const latest = events[events.length - 1]?.sequence ?? cursor;
  return {
    cursor: Math.max(cursor, latest),
    events: events.filter((event) => event.sequence > cursor),
  };
}

export function acknowledgeRouteMessage(
  message: RouteMessage | null,
  messageId: string,
  at: number,
): { message: RouteMessage | null; changed: boolean } {
  if (
    !message ||
    message.messageId !== messageId ||
    message.acknowledgedAt !== null ||
    message.expiresAt <= at
  ) {
    return { message, changed: false };
  }
  return {
    message: { ...message, acknowledgedAt: at },
    changed: true,
  };
}
