"use client";

import { useEffect, useRef } from "react";
import { ASSEMBLY_Z, ROOMS, nextScenarioGuidance, roomById, scenarioObjectById, type RoomId } from "../level";
import { runtime } from "../runtime";
import { useSimulation } from "../store";

const MIN_X = -23.5;
const MAX_X = 23.5;
const MIN_Z = -11;
const MAX_Z = 19;
const W = MAX_X - MIN_X;
const H = MAX_Z - MIN_Z;
const sx = (x: number) => x - MIN_X;
const sy = (z: number) => z - MIN_Z;

const PLAN: RoomId[] = ["sec", "wcorr", "lobby", "ecorr", "vault", "entry", "annex"];
const SHORT: Partial<Record<RoomId, string>> = {
  sec: "LAB 1A",
  lobby: "CORRIDOR",
  vault: "A201",
  entry: "ENTRANCE",
  annex: "SERVICE",
};
const EXIT = scenarioObjectById("main-exit").position;
const ROUTES = [
  { id: "main", label: "main", points: "0,8.7 0,0 0,17.5", color: "#ffc44d" },
  { id: "west", label: "west", points: "0,0 -6.75,2.5 0,17.5", color: "#2fd18f" },
  { id: "east", label: "east", points: "0,0 6.75,2.5 0,17.5", color: "#ff6a3d" },
] as const;

/** Lightweight floorplan layer; the 3D scene remains the only world view. */
export default function Minimap() {
  const mode = useSimulation((state) => state.mode);
  const view = useSimulation((state) => state.view);
  const sector = useSimulation((state) => state.sector);
  const progress = useSimulation((state) => state.scenarioProgress);
  const smoke = useSimulation((state) => state.smokeIntensity);
  const routeStatus = useSimulation((state) => state.routeStatus);
  const latestMessage = useSimulation((state) => state.latestMessage);
  const assignedSector = mode.kind === "warden" ? mode.sectorId : null;
  const guidance = nextScenarioGuidance(progress);
  const objective =
    guidance.id !== "complete" && guidance.id !== "main-exit" ? scenarioObjectById(guidance.id).position : null;
  const you = useRef<SVGGElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (time: number) => {
      raf = requestAnimationFrame(tick);
      if (time - last < 50 || !you.current) return;
      last = time;
      const degrees = (-runtime.evacueeYaw * 180) / Math.PI;
      you.current.setAttribute(
        "transform",
        `translate(${sx(runtime.evacuee.x).toFixed(2)} ${sy(runtime.evacuee.z).toFixed(2)}) rotate(${degrees.toFixed(1)})`,
      );
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const hazardSector = assignedSector ?? sector;
  const hazardBounds = roomById(hazardSector).bounds;
  const hazardVisible = smoke > 0.2 && hazardSector !== "outside";

  return (
    <div className="hud-panel hud-panel-blue p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.18em]">
        <span className="text-paper">Science Block · L1</span>
        <span className="truncate text-paper/50">{roomById(sector).name.split(" / ").pop()}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-[88px] w-[138px] overflow-visible sm:h-[128px] sm:w-[200px]"
        role="img"
         aria-label="Floorplan with current position, hazard reading, route state and exit"
       >
         <rect x={sx(-14)} y={sy(10.5)} width={28} height={8.5} fill="rgba(47,209,143,0.08)" stroke="rgba(248,242,234,0.15)" strokeWidth={0.2} />
        {PLAN.map((id) => {
          const bounds = ROOMS.find((item) => item.id === id)!.bounds;
          const current = sector === id;
          const assigned = assignedSector === id;
          return (
            <g key={id}>
              <rect
                x={sx(bounds.minX)}
                y={sy(bounds.minZ)}
                width={bounds.maxX - bounds.minX}
                height={bounds.maxZ - bounds.minZ}
                fill={current ? "rgba(255,196,77,0.18)" : assigned ? "rgba(47,209,143,0.14)" : "rgba(248,242,234,0.06)"}
                stroke={current ? "#ffc44d" : assigned ? "#2fd18f" : "rgba(248,242,234,0.3)"}
                strokeWidth={current || assigned ? 0.45 : 0.25}
              />
              {SHORT[id] && (
                <text
                  x={sx((bounds.minX + bounds.maxX) / 2)}
                  y={sy((bounds.minZ + bounds.maxZ) / 2)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={current ? "#ffe3a3" : "rgba(248,242,234,0.55)"}
                  fontSize={id === "annex" || id === "entry" ? 1.05 : 1.45}
                  fontFamily="var(--font-geist-mono), monospace"
                  fontWeight="700"
                >
                  {SHORT[id]}
                </text>
              )}
           </g>
         );
         })}
        {ROUTES.map((route) => {
          const blocked = route.id === "east" && routeStatus === "unsafe";
          const recommended = latestMessage?.direction === route.id;
          return (
            <polyline
              key={route.id}
              points={route.points.split(" ").map((point) => {
                const [x, z] = point.split(",").map(Number);
                return `${sx(x)},${sy(z)}`;
              }).join(" ")}
              fill="none"
              stroke={blocked ? "#ef4444" : recommended ? "#39ff88" : route.color}
              strokeWidth={recommended || blocked ? 0.65 : 0.3}
              strokeDasharray={blocked ? "1.2 0.7" : "0.9 0.6"}
              opacity={blocked ? 0.95 : recommended ? 1 : 0.35}
            />
          );
        })}
        {hazardVisible && (
          <rect
            x={sx(hazardBounds.minX)}
            y={sy(hazardBounds.minZ)}
            width={hazardBounds.maxX - hazardBounds.minX}
            height={hazardBounds.maxZ - hazardBounds.minZ}
            fill="#ef4444"
            fillOpacity={Math.min(0.55, 0.1 + smoke * 0.45)}
            stroke="#ef4444"
            strokeWidth={0.35}
            strokeDasharray="0.8 0.5"
          />
        )}
        <circle cx={sx(0)} cy={sy(ASSEMBLY_Z + 2)} r={1.8} fill="none" stroke="#2fd18f" strokeWidth={0.3} strokeDasharray="0.7 0.5" />
        <rect x={sx(EXIT[0]) - 1.1} y={sy(EXIT[2]) - 1.1} width={2.2} height={2.2} fill="#2fd18f" stroke="#16111e" strokeWidth={0.3} />
        {objective && (
          <g transform={`translate(${sx(objective[0])} ${sy(objective[2])})`}>
            <circle r={2.3} fill="none" stroke="#ff6a3d" strokeWidth={0.35} className="signal-pulse" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
            <path d="M0 -1.35 L1.35 0 L0 1.35 L-1.35 0 Z" fill="#ff6a3d" stroke="#16111e" strokeWidth={0.25} />
          </g>
        )}
        <g ref={you} transform={`translate(${sx(0)} ${sy(9)})`}>
          <path d="M0 1.9 L1.25 -1.1 L0 -0.45 L-1.25 -1.1 Z" fill={view === "evidence" ? "#39ff88" : "#ffc44d"} stroke="#16111e" strokeWidth={0.3} />
        </g>
      </svg>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold uppercase tracking-wider text-paper/65">
        <span className="flex items-center gap-1">
          <i className="inline-block h-0 w-0 border-x-[4px] border-t-[7px] border-x-transparent border-t-sun" />
          {mode.kind === "warden" ? "Evacuee" : "You"}
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-2 w-2 rotate-45 bg-coral" />
          Objective
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-2 w-2 bg-mint" />
          Exit
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-2 w-2 border border-coral bg-coral/40" />
          Hazard
        </span>
        {assignedSector && <span className="text-mint">Your sector</span>}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-wider">
        <span style={{ color: routeStatus === "unsafe" ? "var(--coral)" : routeStatus === "intervened" ? "var(--mint)" : "var(--sun)" }}>
          route / {routeStatus}
        </span>
        <span className="text-paper/45">smoke / {Math.round(smoke * 100)}%</span>
      </div>
    </div>
  );
}
