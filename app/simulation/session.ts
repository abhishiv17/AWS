"use client";

import { create } from "zustand";
import { createNet } from "./net";
import { resolveRoom } from "./net/roles";
import { newId, MAX_PLAYERS, type ClientIntent, type CommandAcknowledgement, type DrillRoom, type EvidenceRecord, type EvacueeState, type NetEvent, type NetClient, type Participant, type RouteMessage, type WardenState } from "./net/types";
import type { CommandCode } from "./commands";

export { assignRoles, resolveRoom } from "./net/roles";

export type SessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "notfound"
  | "full"
  | "unavailable"
  | "timeout"
  | "connection";

interface SessionState {
  net: NetClient | null;
  status: SessionStatus;
  code: string | null;
  myId: string | null;
  room: DrillRoom | null;
  isHost: boolean;
  startError: string | null;
  lastEvacueeState: EvacueeState | null;
  lastWardenState: WardenState | null;
  lastStateAt: number;

  connect: (code: string, name: string, asHost?: DrillRoom) => Promise<void>;
  leave: () => void;
  disconnect: (intentional?: boolean) => void;
  startNow: () => Promise<boolean>;
  observeEvidence: (evidenceId: string) => void;
  sendCommand: (command: CommandCode, evidenceId?: string) => void;
  publish: (state: EvacueeState) => void;
  onEvacueeState: (callback: (state: EvacueeState) => void) => () => void;
  onWardenState: (callback: (state: WardenState) => void) => () => void;
  onRouteMessage: (callback: (message: RouteMessage) => void) => () => void;
  onAcknowledgement: (callback: (acknowledgement: CommandAcknowledgement) => void) => () => void;
  onEvidence: (callback: (evidence: EvidenceRecord) => void) => () => void;
}

const evacueeStateSubs = new Set<(state: EvacueeState) => void>();
const wardenStateSubs = new Set<(state: WardenState) => void>();
const routeMessageSubs = new Set<(message: RouteMessage) => void>();
const acknowledgementSubs = new Set<(acknowledgement: CommandAcknowledgement) => void>();
const evidenceSubs = new Set<(evidence: EvidenceRecord) => void>();
let unsubscribe: (() => void) | null = null;

function playerIdForRoom(code: string) {
  const key = `campusevac:participant:${code}`;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const id = newId();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return newId();
  }
}

function statusForJoin(error: string): SessionStatus {
  if (error === "full") return "full";
  if (error === "unavailable") return "unavailable";
  if (error === "timeout") return "timeout";
  if (error === "connection") return "connection";
  return "notfound";
}

export const useSession = create<SessionState>()((set, get) => ({
  net: null,
  status: "idle",
  code: null,
  myId: null,
  room: null,
  isHost: false,
  startError: null,
  lastEvacueeState: null,
  lastWardenState: null,
  lastStateAt: 0,

  connect: async (code, name, seedRoom) => {
    get().leave();
    const net = createNet();
    const myId = playerIdForRoom(code);
    const participant: Participant = {
      id: myId,
      name: name.trim() || "participant",
      role: null,
      sectorId: null,
      joinedAt: Date.now(),
      connected: true,
      reconnectUntil: 0,
    };

    set({ net, myId, code, status: "connecting", startError: null });

    unsubscribe = net.onMessage((event: NetEvent) => {
      switch (event.type) {
        case "room":
          if (event.room.code !== get().code) return;
          set({
            room: event.room,
            status: "connected",
            isHost: event.room.hostId === get().myId,
          });
          break;
        case "evacuee-state":
          set({ lastEvacueeState: event.state, lastStateAt: Date.now() });
          for (const callback of evacueeStateSubs) callback(event.state);
          break;
        case "warden-state":
          set({ lastWardenState: event.state, lastStateAt: Date.now() });
          for (const callback of wardenStateSubs) callback(event.state);
          break;
        case "route-message":
          for (const callback of routeMessageSubs) callback(event.message);
          break;
        case "command-ack":
          set({ startError: null });
          for (const callback of acknowledgementSubs)
            callback(event.acknowledgement);
          break;
        case "evidence":
          for (const callback of evidenceSubs) callback(event.evidence);
          break;
        case "bye":
          break;
      }
    });

    try {
      await net.connect(code);
      if (seedRoom) {
        const created = await net.createRoom({
          ...seedRoom,
          drillId: seedRoom.drillId || `drill_${code}`,
          hostId: "",
        });
        if (!created) {
          net.disconnect();
          unsubscribe?.();
          unsubscribe = null;
          set({ status: "unavailable", net: null });
          return;
        }
      }
    } catch (error) {
      net.disconnect();
      unsubscribe?.();
      unsubscribe = null;
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      set({
        status:
          message.includes("timeout") || message.includes("timed out")
            ? "timeout"
            : "connection",
        net: null,
      });
      return;
    }

    const result = await net.join(code, participant);
    if ("error" in result) {
      net.disconnect();
      unsubscribe?.();
      unsubscribe = null;
      set({ status: statusForJoin(result.error), net: null });
      return;
    }
    set({
      myId: "participantId" in result ? result.participantId ?? participant.id : participant.id,
      room: result.room,
      status: "connected",
      isHost: result.room.hostId === participant.id,
    });
  },

  startNow: async () => {
    const state = get();
    if (
      !state.code ||
      !state.myId ||
      !state.net ||
      !state.room ||
      !state.isHost ||
      (state.room.phase !== "lobby" && state.room.phase !== "preparing") ||
      state.room.participants.length < state.room.maxPlayers
    )
      return false;

    set({ startError: null });
    const result = await state.net.start(state.code, state.myId);
    if (!result.ok) {
      set({ startError: result.error });
      return false;
    }
    return true;
  },

  leave: () => {
    const state = get();
    if (state.net && state.myId && state.code) state.net.leave(state.code, state.myId);
    get().disconnect(true);
  },

  disconnect: (intentional = false) => {
    void intentional;
    const state = get();
    unsubscribe?.();
    unsubscribe = null;
    state.net?.disconnect(intentional);
    evacueeStateSubs.clear();
    wardenStateSubs.clear();
    routeMessageSubs.clear();
    acknowledgementSubs.clear();
    evidenceSubs.clear();
    set({
      net: null,
      status: "idle",
      code: null,
      myId: null,
      room: null,
      isHost: false,
      startError: null,
      lastEvacueeState: null,
      lastWardenState: null,
      lastStateAt: 0,
    });
  },

  observeEvidence: (evidenceId) => {
    const state = get();
    const room = resolveRoom(state.room);
    const participant = room?.participants.find((item) => item.id === state.myId);
    if (!state.net || participant?.role !== "warden") return;
    state.net.send({ type: "observe-evidence", evidenceId, clientSentAt: Date.now() });
  },

  sendCommand: (command, evidenceId) => {
    const state = get();
    const room = resolveRoom(state.room);
    const participant = room?.participants.find((item) => item.id === state.myId);
    if (
      !state.net ||
      !state.myId ||
      !room ||
      room.phase !== "active" ||
      participant?.role !== "warden"
    )
      return;
    const intent: ClientIntent = {
      type: "warden-command",
      command,
      evidenceId,
      clientSentAt: Date.now(),
      idempotencyKey: newId(),
    };
    state.net.send(intent);
  },

  publish: (state) => get().net?.send({ type: "evacuee-state", state }),

  onEvacueeState: (callback) => {
    evacueeStateSubs.add(callback);
    return () => evacueeStateSubs.delete(callback);
  },

  onWardenState: (callback) => {
    wardenStateSubs.add(callback);
    return () => wardenStateSubs.delete(callback);
  },

  onRouteMessage: (callback) => {
    routeMessageSubs.add(callback);
    return () => routeMessageSubs.delete(callback);
  },

  onAcknowledgement: (callback) => {
    acknowledgementSubs.add(callback);
    return () => acknowledgementSubs.delete(callback);
  },

  onEvidence: (callback) => {
    evidenceSubs.add(callback);
    return () => evidenceSubs.delete(callback);
  },
}));

export const myParticipant = (state: SessionState): Participant | null =>
  state.room?.participants.find((participant) => participant.id === state.myId) ?? null;

export const roomIsFull = (room: DrillRoom | null) =>
  !!room && room.participants.length >= Math.min(room.maxPlayers, MAX_PLAYERS);
