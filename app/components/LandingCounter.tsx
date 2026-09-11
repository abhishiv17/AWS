"use client";

import { useEffect, useState } from "react";
import { DbConnection } from "../game/net/spacetime";
import { SPACETIME_AUTH_TOKEN_KEY } from "../lib/auth";

/**
 * The live "moonshots landed" figure.
 *
 * Every browser that opens the site connects to SpacetimeDB and calls
 * `register_landing`, which writes one row per identity - so the number counts
 * distinct visitors rather than page loads, and it counts them globally: a
 * visit from any browser, on any device, ticks the number up for everyone who
 * has the page open, live, without a refresh.
 *
 * `BASE_LANDED` is the pre-launch figure the site shipped with. The real count
 * is added on top rather than replacing it, so the number never appears to
 * fall.
 */
const BASE_LANDED = 150;

export default function LandingCounter() {
  const [landed, setLanded] = useState(0);

  useEffect(() => {
    const host =
      process.env.NEXT_PUBLIC_SPACETIME_HOST || "wss://maincloud.spacetimedb.com";
    const database =
      process.env.NEXT_PUBLIC_SPACETIME_MODULE_NAME || "one-heist-spacetime";
    // Signed in or not, everyone is counted - an anonymous identity is still a
    // distinct visitor, and the landing page must work before you sign in.
    const tokenKey = `campusevac:landing-token:${host}:${database}`;
    let token = "";
    try {
      token =
        localStorage.getItem(SPACETIME_AUTH_TOKEN_KEY) ||
        localStorage.getItem(tokenKey) ||
        "";
    } catch {
      // A private window still connects, it just gets a new identity each time.
    }

    let conn: DbConnection | null = null;
    let live = true;

    const recount = (db: DbConnection["db"]) => {
      if (!live) return;
      let total = 0;
      for (const row of db.landingVisit.iter()) total += row ? 1 : 0;
      setLanded(total);
    };

    try {
      conn = DbConnection.builder()
        .withUri(host)
        .withDatabaseName(database)
        .withToken(token)
        .onConnect((connection, _identity, nextToken) => {
          try {
            localStorage.setItem(tokenKey, nextToken);
          } catch {
            /* nothing to persist in a private window */
          }
          // idempotent server-side: one row per identity, re-visits are no-ops
          void connection.reducers.registerLanding({});
        })
        .onConnectError(() => {
          /* leave the seeded figure showing */
        })
        .build();

      conn.db.landingVisit.onInsert(() => conn && recount(conn.db));
      conn.db.landingVisit.onDelete(() => conn && recount(conn.db));
      conn
        .subscriptionBuilder()
        .onApplied((ctx) => recount(ctx.db))
        .subscribe(["SELECT * FROM landing_visit"]);
    } catch {
      /* the seeded figure is the fallback */
    }

    return () => {
      live = false;
      conn?.disconnect();
    };
  }, []);

  return <>{(BASE_LANDED + landed).toLocaleString("en-US")}</>;
}
