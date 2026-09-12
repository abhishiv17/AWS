"use client";

import { useEffect, useRef } from "react";
import { ASSEMBLY_Z, ROOMS, roomById, type RoomId } from "../level";
import { runtime } from "../runtime";
import { useGame } from "../store";

const MIN_X = -23.5;
const MAX_X = 23.5;
const MIN_Z = -11;
const MAX_Z = 20;
const W = MAX_X - MIN_X;
const H = MAX_Z - MIN_Z;
const sx = (x: number) => x - MIN_X;
const sy = (z: number) => z - MIN_Z;

const PLAN: RoomId[] = ["sec", "wcorr", "lobby", "ecorr", "vault", "entry", "annex"];
const SHORT: Partial<Record<RoomId, string>> = {
  sec: "UTIL",
  wcorr: "WEST",
  lobby: "JUNCTION",
  ecorr: "EAST",
  vault: "DORM",
  entry: "FOYER",
  annex: "SERVICE",
};

/** Lightweight floorplan layer; the 3D scene remains the only world view. */
export default function Minimap() {
  const mode = useGame((state) => state.mode);
  const evacueeSector = useGame((state) => state.sector);
  const assignedSector = mode.kind === "warden" ? mode.sectorId : null;
  const evacuee = useRef<SVGCircleElement>(null);
  const direction = useRef<SVGLineElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (time: number) => {
      raf = requestAnimationFrame(tick);
      if (time - last < 50) return;
      last = time;
      if (evacuee.current) {
        evacuee.current.setAttribute("cx", String(sx(runtime.evacuee.x)));
        evacuee.current.setAttribute("cy", String(sy(runtime.evacuee.z)));
      }
      if (direction.current) {
        const length = 2.6;
        direction.current.setAttribute("x1", String(sx(runtime.evacuee.x)));
        direction.current.setAttribute("y1", String(sy(runtime.evacuee.z)));
        direction.current.setAttribute(
          "x2",
          String(sx(runtime.evacuee.x) + Math.sin(runtime.evacueeYaw) * length),
        );
        direction.current.setAttribute(
          "y2",
          String(sy(runtime.evacuee.z) + Math.cos(runtime.evacueeYaw) * length),
        );
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hud-panel hud-panel-blue p-2">
      <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-widest text-zinc-500">
        <span>Floorplan</span>
        <span className="text-zinc-400">{roomById(evacueeSector).name}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-[86px] w-[128px] overflow-visible sm:h-[132px] sm:w-[196px]"
        role="img"
        aria-label="Campus floorplan"
      >
        <rect
          x={sx(-14)}
          y={sy(10.5)}
          width={28}
          height={9}
          fill="#12161c"
          stroke="#2a313a"
          strokeWidth={0.2}
        />
        <g stroke="#606b79" strokeWidth={0.28} strokeDasharray="0.8 0.55" opacity={0.7}>
          <path d={`M ${sx(-15)} ${sy(0)} L ${sx(0)} ${sy(0)} L ${sx(15)} ${sy(0)}`} fill="none" />
          <path d={`M ${sx(0)} ${sy(0)} L ${sx(0)} ${sy(8.7)}`} fill="none" />
          <path d={`M ${sx(15)} ${sy(0)} L ${sx(15)} ${sy(-8.5)}`} fill="none" />
        </g>
        {PLAN.map((id) => {
          const room = ROOMS.find((item) => item.id === id)!;
          const bounds = room.bounds;
          const assigned = assignedSector === id;
          return (
            <g key={id}>
              <rect
                x={sx(bounds.minX)}
                y={sy(bounds.minZ)}
                width={bounds.maxX - bounds.minX}
                height={bounds.maxZ - bounds.minZ}
                fill={assigned ? "#1d2b24" : "#171c23"}
                stroke={assigned ? "#10b981" : "#39414d"}
                strokeWidth={assigned ? 0.5 : 0.25}
              />
              <text
                x={sx((bounds.minX + bounds.maxX) / 2)}
                y={sy((bounds.minZ + bounds.maxZ) / 2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={assigned ? "#baffd4" : "#697382"}
                fontSize={id === "lobby" || id === "vault" || id === "entry" ? 1.45 : 1.1}
                fontFamily="monospace"
                fontWeight="700"
              >
                {SHORT[id]}
              </text>
            </g>
          );
        })}
        <circle
          cx={sx(0)}
          cy={sy(ASSEMBLY_Z + 2)}
          r={1.1}
          fill="none"
          stroke="#10b981"
          strokeWidth={0.35}
        />
        <line
          ref={direction}
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(0)}
          y2={sy(2.6)}
          stroke="#38bdf8"
          strokeWidth={0.45}
          strokeLinecap="square"
        />
        <circle ref={evacuee} r={1.05} fill="#38bdf8" stroke="#000" strokeWidth={0.2} />
      </svg>
      <div className="mt-1 flex gap-3 text-[9px] text-zinc-500">
        <span className="text-sky-400">● evacuee</span>
        <span className="text-sky-400">→ heading</span>
        {assignedSector && <span className="text-emerald-400">▭ assigned sector</span>}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-widest text-zinc-600">
        {roomById(evacueeSector).name} / live position
      </div>
    </div>
  );
}
