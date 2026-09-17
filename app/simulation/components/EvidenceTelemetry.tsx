"use client";

import { roomById } from "../level";
import { useSimulation } from "../store";

function routeColor(status: "clear" | "unsafe" | "intervened") {
  return status === "unsafe" ? "var(--coral)" : status === "intervened" ? "var(--mint)" : "var(--sun)";
}

export default function EvidenceTelemetry() {
  const mode = useSimulation((state) => state.mode);
  const view = useSimulation((state) => state.view);
  const sector = useSimulation((state) => state.sector);
  const coreSnapshot = useSimulation((state) => state.coreSnapshot);
  const smoke = useSimulation((state) => state.smokeIntensity);
  const legacyRouteStatus = useSimulation((state) => state.routeStatus);
  const interventionApplied = useSimulation((state) => state.interventionApplied);
  const evidenceMap = useSimulation((state) => state.evidence);
  const latestMessage = useSimulation((state) => state.latestMessage);
  const telemetry = useSimulation((state) => state.telemetry);
  const telemetryCursor = useSimulation((state) => state.telemetryCursor);
  const evidence = Object.values(evidenceMap);

  if (view === "evacuee") return null;

  const verified = evidence.filter((item) => item.status === "VERIFIED").length;
  const telemetryRoom = mode.kind === "warden" ? mode.sectorId : sector;
  const location = roomById(telemetryRoom).name.split(" / ").pop() ?? roomById(telemetryRoom).name;
  const hazard = coreSnapshot?.hazards[telemetryRoom];
  const smokeReading = hazard?.density ?? smoke;
  const eastRoute = coreSnapshot?.connectors["lobby-ecorr"];
  const routeStatus = coreSnapshot
    ? interventionApplied || coreSnapshot.incident.ventilationActive
      ? "intervened"
      : eastRoute?.status === "open"
        ? "clear"
        : "unsafe"
    : legacyRouteStatus;
  const accountability = coreSnapshot?.report.metrics.accountability;
  const scope = mode.kind === "warden" ? `Assigned sector / ${mode.sectorId}` : "Local simulation reading";

  return (
    <section className="hud-panel pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] p-3" aria-label="Operational telemetry">
      <div className="flex items-baseline justify-between gap-3 border-b border-paper/15 pb-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-mint">Operational telemetry</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-paper/45">
          {coreSnapshot ? "core report" : "observed state"}
        </span>
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-paper/50">{scope}</div>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        <div className="border border-paper/10 bg-night/40 p-2">
          <dt className="text-[9px] font-black uppercase tracking-wider text-paper/45">Sector</dt>
          <dd className="mt-1 truncate text-[12px] font-black text-paper">{location}</dd>
        </div>
        <div className="border border-paper/10 bg-night/40 p-2">
          <dt className="text-[9px] font-black uppercase tracking-wider text-paper/45">Smoke reading</dt>
            <dd className="mt-1 font-mono text-[12px] font-black" style={{ color: smokeReading > 0.45 ? "var(--coral)" : "var(--sun)" }}>
            {Math.round(smokeReading * 100)}%
          </dd>
        </div>
        <div className="border border-paper/10 bg-night/40 p-2">
          <dt className="text-[9px] font-black uppercase tracking-wider text-paper/45">Route state</dt>
          <dd className="mt-1 text-[12px] font-black uppercase" style={{ color: routeColor(routeStatus) }}>
            {routeStatus}
          </dd>
        </div>
        <div className="border border-paper/10 bg-night/40 p-2">
          <dt className="text-[9px] font-black uppercase tracking-wider text-paper/45">Evidence</dt>
          <dd className="mt-1 font-mono text-[12px] font-black text-paper">
            {verified}/{evidence.length} verified
          </dd>
        </div>
      </dl>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-paper/10 pt-2 text-[10px] uppercase tracking-wider text-paper/60">
         <span>Intervention / <strong className={interventionApplied ? "text-mint" : "text-paper"}>{interventionApplied ? "applied" : "not applied"}</strong></span>
         <span>Assembly / <strong className="text-paper">{accountability ? `${accountability.assembled}/${accountability.total}` : "not logged"}</strong></span>
         {coreSnapshot && <span>Events / <strong className="text-paper">{coreSnapshot.report.metrics.eventCount}</strong></span>}
      </div>
      {latestMessage && (
        <div className="mt-2 border-l-2 border-mint bg-mint/5 px-2 py-1.5 text-[10px] leading-snug text-paper/75">
          <span className="font-black uppercase tracking-wider text-mint">Last route message:</span> {latestMessage.caption}
        </div>
      )}
      {mode.kind === "warden" && (
        <div className="mt-2 border-t border-paper/10 pt-2">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-paper/45">
            <span>Guide telemetry</span>
            <span className="font-mono">cursor / {telemetryCursor}</span>
          </div>
          {telemetry.length === 0 ? (
            <p className="mt-1 text-[10px] text-paper/40">No authoritative guide events received.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-[10px] text-paper/65">
              {telemetry.slice(-3).reverse().map((event) => (
                <li key={event.sequence}>
                  <span className="font-mono text-mint">#{event.sequence}</span>{" "}
                  {event.type.replace(/_/g, " ").toLowerCase()}
                  {"messageId" in event ? ` · ${event.messageId}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="mt-2 text-[9px] leading-snug text-paper/40">Sector-scoped readings. Verify evidence before issuing route guidance.</p>
    </section>
  );
}
