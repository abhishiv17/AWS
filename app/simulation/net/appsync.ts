"use client";

import type {
  ClientIntent,
  CommandAcknowledgement,
  DrillRoom,
  NetClient,
  NetEvent,
  StartResult,
} from "./types";

type GraphqlResponse<T> = {
  data?: T;
  errors?: { message?: string }[];
};

export interface AppSyncTransport {
  request<T>(query: string, variables: Record<string, unknown>): Promise<T>;
  subscribe?(code: string, onEvent: (event: NetEvent) => void): () => void;
}

const ROOM_QUERY = /* GraphQL */ `
  query Drill($code: String!) {
    drill(code: $code) {
       drillId code hostId maxPlayers phase startsAt
       participants { id name role sectorId joinedAt connected reconnectUntil }
       createdAt
       scenarioVersion seed outcome
    }
  }
`;

const CREATE_DRILL = /* GraphQL */ `
  mutation CreateDrill($input: CreateDrillInput!) {
    createDrill(input: $input) {
       drillId code hostId maxPlayers phase startsAt
       participants { id name role sectorId joinedAt connected reconnectUntil }
       createdAt
       scenarioVersion seed outcome
    }
  }
`;

const JOIN_DRILL = /* GraphQL */ `
  mutation JoinDrill($input: JoinDrillInput!) {
    joinDrill(input: $input) {
       drillId code hostId maxPlayers phase startsAt
       participants { id name role sectorId joinedAt connected reconnectUntil }
       createdAt
       scenarioVersion seed outcome
    }
  }
`;

const START_DRILL = /* GraphQL */ `
  mutation StartDrill($drillId: ID!, $playerId: ID!) {
    startDrill(drillId: $drillId, playerId: $playerId) { ok error }
  }
`;

const SUBMIT_INTENT = /* GraphQL */ `
  mutation SubmitIntent($drillId: ID!, $intent: DrillIntentInput!) {
    submitIntent(drillId: $drillId, intent: $intent) {
      acknowledgement { id command accepted reason at stateVersion eventSequence }
      routeMessage { messageId drillId senderId senderSector targetSector direction kind confidence urgency createdAt expiresAt caption acknowledgedAt }
      evidence { id sectorId label source status observedAt verifiedAt updatedAt nextAction }
    }
  }
`;

const LEAVE_DRILL = /* GraphQL */ `
  mutation LeaveDrill($drillId: ID!, $playerId: ID!) {
    leaveDrill(drillId: $drillId, playerId: $playerId) { ok }
  }
`;

function asError(response: GraphqlResponse<unknown>) {
  return new Error(response.errors?.map((error) => error.message).filter(Boolean).join(", ") || "AppSync request failed");
}

/** HTTP GraphQL transport. Auth is supplied by the deployment, never by a browser secret. */
class HttpAppSyncTransport implements AppSyncTransport {
  constructor(private readonly endpoint: string) {}

  async request<T>(query: string, variables: Record<string, unknown>) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query, variables }),
    });
    const payload = (await response.json()) as GraphqlResponse<T>;
    if (!response.ok || payload.errors?.length) throw asError(payload);
    if (!payload.data) throw new Error("AppSync returned no data");
    return payload.data;
  }
}

/**
 * AppSync adapter. The optional subscription function is deliberately injected
 * so AppSync Events/Cognito setup can evolve without leaking provider details
 * into the renderer. Mutations remain role-checked by the GraphQL resolver.
 */
export class AppSyncNet implements NetClient {
  readonly kind = "appsync" as const;
  private readonly transport: AppSyncTransport;
  private readonly listeners = new Set<(event: NetEvent) => void>();
  private unsubscribeEvents: (() => void) | null = null;
  private code = "";
  private drillId = "";
  private participantId = "";

  constructor(transport?: AppSyncTransport) {
    const endpoint = process.env.NEXT_PUBLIC_APPSYNC_URL?.trim();
    if (!transport && !endpoint)
      throw new Error("NEXT_PUBLIC_APPSYNC_URL is not configured");
    this.transport = transport ?? new HttpAppSyncTransport(endpoint!);
  }

  async connect(code: string) {
    this.code = code;
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = this.transport.subscribe?.(code, (event) => this.emit(event)) ?? null;
    const result = await this.transport.request<{ drill: DrillRoom | null }>(
      ROOM_QUERY,
      { code },
    );
    if (result.drill) {
      this.drillId = result.drill.drillId;
      this.emit({ type: "room", room: result.drill });
    }
  }

  disconnect() {
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = null;
    this.listeners.clear();
    this.code = "";
    this.drillId = "";
    this.participantId = "";
  }

  async createRoom(room: DrillRoom) {
    const result = await this.transport.request<{ createDrill: DrillRoom }>(
      CREATE_DRILL,
      { input: room },
    );
    this.drillId = result.createDrill.drillId;
    this.emit({ type: "room", room: result.createDrill });
    return result.createDrill;
  }

  async join(code: string, participant: DrillRoom["participants"][number]) {
    try {
      const result = await this.transport.request<{ joinDrill: DrillRoom }>(
        JOIN_DRILL,
        { input: { code, participant } },
      );
      this.code = code;
      this.drillId = result.joinDrill.drillId;
      this.participantId =
        result.joinDrill.participants.find(
          (item) => item.name === participant.name && item.joinedAt === participant.joinedAt,
        )?.id ?? participant.id;
      this.emit({ type: "room", room: result.joinDrill });
      return { room: result.joinDrill, participantId: this.participantId } as const;
    } catch (error) {
      return { error: classifyJoinError(error) } as const;
    }
  }

  async start(code: string, playerId: string): Promise<StartResult> {
    try {
      const result = await this.transport.request<{ startDrill: { ok: boolean; error?: string } }>(
        START_DRILL,
        { drillId: this.drillId || code, playerId },
      );
      return result.startDrill.ok
        ? { ok: true }
        : { ok: false, error: classifyStartError(result.startDrill.error) };
    } catch (error) {
      return { ok: false, error: classifyStartError(error instanceof Error ? error.message : String(error)) };
    }
  }

  send(intent: ClientIntent) {
    if (!this.drillId) return;
    void this.transport
      .request<{
        submitIntent: {
          acknowledgement?: CommandAcknowledgement;
          routeMessage?: NetEvent extends never ? never : Extract<NetEvent, { type: "route-message" }>['message'];
          evidence?: Extract<NetEvent, { type: "evidence" }>['evidence'];
        };
      }>(SUBMIT_INTENT, { drillId: this.drillId, intent })
      .then((result) => {
        const response = result.submitIntent;
        if (response.acknowledgement)
          this.emit({ type: "command-ack", acknowledgement: response.acknowledgement });
        if (response.routeMessage)
          this.emit({ type: "route-message", message: response.routeMessage });
        if (response.evidence) this.emit({ type: "evidence", evidence: response.evidence });
      })
      .catch((error) => {
        if (intent.type !== "warden-command") return;
        const acknowledgement: CommandAcknowledgement = {
          id: `${this.drillId}:transport-error:${Date.now()}`,
          command: intent.command,
          accepted: false,
          reason: error instanceof Error ? error.message : "AppSync request failed",
          at: Date.now(),
          stateVersion: 0,
          eventSequence: 0,
        };
        this.emit({ type: "command-ack", acknowledgement });
      });
  }

  leave(_code: string, playerId: string) {
    if (!this.drillId) return;
    void this.transport.request(LEAVE_DRILL, {
      drillId: this.drillId,
      playerId,
    });
  }

  onMessage(callback: (event: NetEvent) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: NetEvent) {
    for (const callback of this.listeners) callback(event);
  }
}

function classifyJoinError(error: unknown): "notfound" | "full" | "unavailable" | "timeout" | "connection" {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("full")) return "full";
  if (message.includes("not found") || message.includes("no such")) return "notfound";
  if (message.includes("timeout") || message.includes("timed out")) return "timeout";
  if (message.includes("started") || message.includes("unavailable")) return "unavailable";
  return "connection";
}

function classifyStartError(value: unknown): "notfound" | "not-host" | "not-ready" | "started" {
  const message = value instanceof Error ? value.message.toLowerCase() : String(value ?? "").toLowerCase();
  if (message.includes("host")) return "not-host";
  if (message.includes("ready") || message.includes("player")) return "not-ready";
  if (message.includes("started") || message.includes("phase")) return "started";
  return "notfound";
}
