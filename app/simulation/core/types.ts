import type { SimulationClock } from "./clock";
import type {
  ConnectorStatus,
  HazardClassification,
  SimulationEventLog,
} from "./events";
import type { Bounds, RoomId, Vec3 } from "../level";

export type SimulationPhase = "idle" | "running" | "completed" | "failed";
export type AccessibilityRequirement = "standard" | "accessible";
export type OccupantBehavior = "calm" | "hesitant" | "panic";
export type InjuryState = "none" | "minor" | "serious" | "incapacitated";

export interface WorldRoom {
  id: RoomId;
  name: string;
  bounds: Bounds;
  capacity?: number;
}

export interface ConnectorDefinition {
  id: string;
  from: RoomId;
  to: RoomId;
  bidirectional: boolean;
  doorId?: string;
  accessible?: boolean;
  capacity?: number;
  travelTicks?: number;
  smokeConductance?: number;
}

export interface ExitDefinition {
  id: string;
  roomId: RoomId;
  assemblyZoneId: string;
  accessible?: boolean;
  position?: Vec3;
  capacity?: number;
}

export interface AssemblyZoneDefinition {
  id: string;
  roomId: RoomId;
  position?: Vec3;
  capacity?: number;
}

export interface WorldDefinition {
  id: string;
  version: string;
  rooms: readonly WorldRoom[];
  connectors: readonly ConnectorDefinition[];
  exits: readonly ExitDefinition[];
  assemblyZones: readonly AssemblyZoneDefinition[];
}

export interface IncidentDefinition {
  originRoomId: RoomId;
  ignitionDelaySeconds: number;
  generationRate: number;
  dissipationRate: number;
  ventilationFactor: number;
}

export interface OccupantDefinition {
  id: string;
  profile: string;
  spawnRoomId: RoomId;
  spawnPosition: Vec3;
  mobility: "independent" | "assisted";
  behavior?: OccupantBehavior;
  accessibility?: AccessibilityRequirement;
  decisionDelayTicks?: number;
}

export interface ScenarioDefinition {
  id: string;
  version: string;
  seed: number;
  durationSeconds?: number;
  world: WorldDefinition;
  incident: IncidentDefinition;
  occupants: readonly OccupantDefinition[];
}

export interface HazardReading {
  density: number;
  classification: HazardClassification;
  updatedAtTick: number;
}

export interface ConnectorState {
  status: ConnectorStatus;
  smokeDensity: number;
  updatedAtTick: number;
  reason: string | null;
}

export interface IncidentState {
  originRoomId: RoomId;
  ignited: boolean;
  intensity: number;
  ventilationActive: boolean;
}

export interface OccupantState {
  id: string;
  profile: string;
  mobility: OccupantDefinition["mobility"];
  status:
    | "waiting"
    | "moving"
    | "queued"
    | "distressed"
    | "injured"
    | "needs-assistance"
    | "assembled"
    | "missing";
  roomId: RoomId;
  position: Vec3;
  health: number;
  air: number;
  exposure: number;
  injury: InjuryState;
  behavior: OccupantBehavior;
  accessibility: AccessibilityRequirement;
  decisionDelayTicks: number;
  targetExitId: string | null;
  route: string[];
  routeIndex: number;
  travelConnectorId: string | null;
  travelTicksRemaining: number;
  lastDecisionTick: number | null;
  assembledAtTick: number | null;
  injuredAtTick: number | null;
  assistanceRequestedAtTick: number | null;
}

export interface AssemblyZoneState {
  zoneId: string;
  arrivedOccupantIds: string[];
  queuedOccupantIds: string[];
}

export interface SimulationState {
  runId: string;
  scenarioId: string;
  scenarioVersion: string;
  seed: number;
  phase: SimulationPhase;
  clock: SimulationClock;
  incident: IncidentState;
  hazards: Record<RoomId, HazardReading>;
  connectors: Record<string, ConnectorState>;
  occupants: Record<string, OccupantState>;
  assemblies: Record<string, AssemblyZoneState>;
  eventLog: SimulationEventLog;
}

export type SimulationCommand =
  | { type: "start"; commandId: string; actorId: string }
  | { type: "pause"; commandId: string; actorId: string }
  | { type: "player-pose"; commandId: string; actorId: string; roomId: RoomId; position: Vec3 }
  | { type: "set-ventilation"; commandId: string; actorId: string; active: boolean };
