"use client";

import { useSimulation } from "../store";

function hazardColor(classification: string) {
  return classification === "blocked"
    ? "var(--danger)"
    : classification === "dangerous"
      ? "var(--coral)"
      : classification === "caution"
        ? "var(--sun)"
        : "var(--mint)";
}

function statusColor(status: string) {
  return status === "blocked"
    ? "var(--danger)"
    : status === "compromised"
      ? "var(--coral)"
      : "var(--mint)";
}

function shortName(name: string) {
  return name.split(" / ").pop() ?? name;
}

export default function GuideTacticalPanel() {
  const mode = useSimulation((state) => state.mode);
  const projection = useSimulation((state) => state.guideProjection);

  if (mode.kind !== "warden") return null;
  if (!projection) {
    return (
      <section className="hud-panel pointer-events-auto w-[min(31rem,calc(100vw-1.5rem))] p-3" aria-label="Guide tactical projection">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-mint">Tactical block</div>
        <p className="mt-2 text-[11px] text-paper/55">Waiting for the authority snapshot.</p>
      </section>
    );
  }

  const maya = projection.occupants.find((occupant) => occupant.id === "maya");
  const nextConnector = projection.recommendation?.connectorIds[0] ?? null;
  const recommendationLabel = projection.recommendation?.found
    ? `${projection.recommendation.targetExitId} / ${projection.recommendation.safetyRating}`
    : "no open exit from the Navigator sector";

  return (
    <section className="hud-panel pointer-events-auto w-[min(31rem,calc(100vw-1.5rem))] p-3" aria-label="Guide tactical projection">
      <div className="flex items-baseline justify-between gap-3 border-b border-paper/15 pb-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-mint">Tactical block</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-paper/45">
          {projection.rooms.length} rooms / {projection.connectors.length} links / t{projection.tick}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wider">
        <div className="border border-paper/10 bg-night/40 p-2">
          <div className="text-[9px] font-black text-paper/45">Navigator</div>
          <div className="mt-1 truncate font-black text-paper">
            {projection.navigator ? shortName(projection.rooms.find((room) => room.id === projection.navigator?.sectorId)?.name ?? projection.navigator.sectorId) : "not connected"}
          </div>
        </div>
        <div className="border border-paper/10 bg-night/40 p-2">
          <div className="text-[9px] font-black text-paper/45">Maya</div>
          <div className="mt-1 truncate font-black" style={{ color: maya ? hazardColor(maya.status === "needs-assistance" ? "dangerous" : "clear") : "var(--paper)" }}>
            {maya ? `${shortName(projection.rooms.find((room) => room.id === maya.roomId)?.name ?? maya.roomId)} / ${maya.status}` : "not logged"}
          </div>
        </div>
      </div>

      <div className="mt-2 border-l-4 border-sun bg-sun/5 px-2 py-1.5 text-[10px] leading-snug">
        <div className="font-black uppercase tracking-wider text-sun">Measured recommendation</div>
        <div className="mt-0.5 font-black uppercase text-paper">{recommendationLabel}</div>
        <div className="mt-0.5 text-paper/55">
          {nextConnector ? `Next link / ${nextConnector}` : "No connector sequence is available from the current sector."}
        </div>
      </div>

      <div className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-paper/45">Room heatmap</div>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {projection.rooms.map((room) => (
          <div key={room.id} className="border border-paper/10 bg-night/40 px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-bold text-paper">{shortName(room.name)}</span>
              <span className="font-mono text-[9px] font-black" style={{ color: hazardColor(room.classification) }}>
                {Math.round(room.density * 100)}%
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-[8px] uppercase tracking-wider">
              <span style={{ color: hazardColor(room.classification) }}>{room.classification}</span>
              <span className="truncate text-paper/45">{room.occupantIds.join(", ") || "clear"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-paper/45">Connector status</div>
      <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {projection.connectors.map((connector) => (
          <div key={connector.id} className="flex items-center justify-between gap-2 border border-paper/10 bg-night/40 px-2 py-1.5 text-[9px]">
            <span className="truncate font-mono text-paper/70">{connector.from} -&gt; {connector.to}</span>
            <span className="shrink-0 font-black uppercase" style={{ color: statusColor(connector.status) }}>{connector.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
