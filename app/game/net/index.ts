"use client";

import { AppSyncNet } from "./appsync";
import { MockNet } from "./mockNet";
import type { NetClient } from "./types";

/** Local development is deterministic; AppSync is opt-in until deployed. */
export function createNet(): NetClient {
  const mode = process.env.NEXT_PUBLIC_NETWORK_MODE?.trim().toLowerCase();
  if (mode === "appsync") return new AppSyncNet();
  return new MockNet();
}

export * from "./types";
