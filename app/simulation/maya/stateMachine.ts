import { MAYA_SPAWN } from "../level";
import type {
  MayaEvent,
  MayaState,
  MayaContext,
} from "./types";

/**
 * Creates the deterministic initial Maya state at drill start.
 * Maya spawns in Classroom 205 (Vulnerable Peer room).
 */
export function createInitialMayaState(): MayaState {
  return {
    status: "CALM",
    position: [...MAYA_SPAWN],
    rotation: 0,
    health: 100,
    air: 100,
    smokeExposure: 0,
    sectorId: "classroom-205",
    currentWaypointIndex: 0,
    assignedPath: [],
    targetExit: null,
    distanceToPlayer: 999,
    assistedAt: null,
    abandonedAt: null,
    safeAt: null,
    dialogue: null,
    dialogueTimestamp: 0,
  };
}

/**
 * Pure deterministic state transition function for Maya's state machine.
 */
export function transitionMaya(
  current: MayaState,
  event: MayaEvent,
  context: MayaContext,
): MayaState {
  // Safe state is final; Maya has successfully evacuated
  if (current.status === "SAFE") {
    return current;
  }

  // Incapacitated state is terminal under current drill parameters
  if (current.status === "INCAPACITATED") {
    return current;
  }

  // Check air exhaustion
  if (event.type === "incapacitated" || current.air <= 0) {
    return {
      ...current,
      status: "INCAPACITATED",
      health: 0,
      dialogue: "Maya has collapsed from toxic smoke inhalation...",
      dialogueTimestamp: context.elapsedSeconds,
    };
  }

  switch (event.type) {
    case "alarm": {
      if (current.status === "CALM") {
        return {
          ...current,
          status: "ALARMED",
          dialogue: "Is that the fire alarm?! What's happening?!",
          dialogueTimestamp: context.elapsedSeconds,
        };
      }
      return current;
    }

    case "player_approached": {
      if (current.status === "ALARMED" || current.status === "CALM") {
        return {
          ...current,
          status: "WAITING_FOR_HELP",
          dialogue: "Hey! I can't find the exit, the alarms are deafening. Can you help me?!",
          dialogueTimestamp: context.elapsedSeconds,
        };
      }
      return current;
    }

    case "assisted": {
      if (
        current.status === "WAITING_FOR_HELP" ||
        current.status === "ALARMED" ||
        current.status === "LOST" ||
        current.status === "REASSESSING"
      ) {
        return {
          ...current,
          status: "FOLLOWING",
          assistedAt: context.elapsedSeconds,
          dialogue: "Thank you! I'm right behind you, lead the way!",
          dialogueTimestamp: context.elapsedSeconds,
        };
      }
      return current;
    }

    case "abandoned": {
      return {
        ...current,
        status: "ABANDONED",
        abandonedAt: context.elapsedSeconds,
        dialogue: "Wait! Don't leave me here alone!",
        dialogueTimestamp: context.elapsedSeconds,
      };
    }

    case "hazard_detected": {
      if (current.status === "FOLLOWING" || current.status === "DISTRESSED") {
        return {
          ...current,
          status: "REASSESSING",
          dialogue:
            event.message ??
            `There's heavy smoke in ${event.dangerSector}! We can't go through there!`,
          dialogueTimestamp: context.elapsedSeconds,
        };
      }
      return current;
    }

    case "player_distanced": {
      if (current.status === "FOLLOWING" || current.status === "REASSESSING") {
        return {
          ...current,
          status: "LOST",
          dialogue: "Where did you go?! I lost sight of you!",
          dialogueTimestamp: context.elapsedSeconds,
        };
      }
      return current;
    }

    case "player_rejoined": {
      if (current.status === "LOST") {
        return {
          ...current,
          status: "FOLLOWING",
          dialogue: "There you are! Please don't run so far ahead!",
          dialogueTimestamp: context.elapsedSeconds,
        };
      }
      return current;
    }

    case "smoke_increased": {
      if (event.density >= 0.45 && current.status === "FOLLOWING") {
        return {
          ...current,
          status: "DISTRESSED",
          dialogue: "I can't breathe... the smoke is too dense... *cough*",
          dialogueTimestamp: context.elapsedSeconds,
        };
      }
      if (event.density < 0.30 && current.status === "DISTRESSED") {
        return {
          ...current,
          status: "FOLLOWING",
          dialogue: "The air is clearer here. Let's keep moving!",
          dialogueTimestamp: context.elapsedSeconds,
        };
      }
      return current;
    }

    case "reached_muster": {
      return {
        ...current,
        status: "SAFE",
        targetExit: event.exit,
        safeAt: context.elapsedSeconds,
        dialogue: "We made it outside! Thank you so much for getting me out safely!",
        dialogueTimestamp: context.elapsedSeconds,
      };
    }

    default:
      return current;
  }
}
