"use client";

import { useEffect, useRef } from "react";
import { ASSEMBLY_A_POS, ASSEMBLY_B_POS, ROOMS, roomById, type RoomId } from "../level";
import { runtime } from "../runtime";
import { useSimulation } from "../store";

/* Coordinate system matching the Level 2 layout. */
const MIN_X = -26;
const MAX_X = 26;
const MIN_Z = -12;
const MAX_Z = 28;
const W = MAX_X - MIN_X;
const H = MAX_Z - MIN_Z;
const sx = (x: number) => x - MIN_X;
const sy = (z: number) => z - MIN_Z;

/** Rooms rendered on the minimap floor plan. */
const PLAN: RoomId[] = [
  "classroom-204",
  "workshop-203",
  "classroom-205",
  "corridor-west",
  "junction-center",
  "corridor-east",
  "lab-201",
  "lab-202",
  "chem-store",
  "prep-room",
  "stair-west",
  "stair-east",
];

const SHORT: Partial<Record<RoomId, string>> = {
  "classroom-204": "C204",
  "workshop-203": "W203",
  "classroom-205": "C205",
  "corridor-west": "WEST",
  "junction-center": "JUNCT",
  "corridor-east": "EAST",
  "lab-201": "LAB-1",
  "lab-202": "LAB-2",
  "chem-store": "CHEM",
  "prep-room": "PREP",
  "stair-west": "EXIT A",
  "stair-east": "EXIT B",
};

/** Lightweight floorplan layer; the 3D scene remains the only world view. */
export default function Minimap() {
  const mode = useSimulation((state) => state.mode);
  const evacueeSector = useSimulation((state) => state.sector);
  const assignedSector = mode.kind === "warden" ? mode.sectorId : null;
  const navPath = useSimulation((state) => state.navPath);
  const targetExit = useSimulation((state) => state.targetExit);
  const navSafetyRating = useSimulation((state) => state.navSafetyRating);
  const maya = useSimulation((state) => state.maya);
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
        {/* Central corridor spine */}
        <g stroke="#606b79" strokeWidth={0.28} strokeDasharray="0.8 0.55" opacity={0.7}>
          <path d={`M ${sx(-22)} ${sy(0)} L ${sx(22)} ${sy(0)}`} fill="none" />
        </g>

        {/* Room rectangles */}
        {PLAN.map((id) => {
          const room = ROOMS.find((item) => item.id === id);
          if (!room) return null;
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
                fontSize={id === "junction-center" || id === "stair-west" || id === "stair-east" ? 1.45 : 1.1}
                fontFamily="monospace"
                fontWeight="700"
              >
                {SHORT[id]}
              </text>
            </g>
          );
        })}

        {/* Active Safe Navigation Route Polyline */}
        {navPath && navPath.length > 1 && (
          <g>
            <polyline
              points={navPath
                .map((n) => `${sx(n.position[0])},${sy(n.position[2])}`)
                .join(" ")}
              fill="none"
              stroke={
                navSafetyRating === "safe"
                  ? "#10b981"
                  : navSafetyRating === "caution"
                    ? "#f59e0b"
                    : "#ef4444"
              }
              strokeWidth={0.65}
              strokeDasharray="1.4 0.7"
              opacity={0.85}
            />
            {navPath.map((node, i) => (
              <circle
                key={node.id}
                cx={sx(node.position[0])}
                cy={sy(node.position[2])}
                r={i === 0 || i === navPath.length - 1 ? 0.65 : 0.4}
                fill={
                  navSafetyRating === "safe"
                    ? "#10b981"
                    : navSafetyRating === "caution"
                      ? "#f59e0b"
                      : "#ef4444"
                }
                opacity={0.7}
              />
            ))}
          </g>
        )}

        {/* Assembly Beacon A (West) */}
        <circle
          cx={sx(ASSEMBLY_A_POS[0])}
          cy={sy(ASSEMBLY_A_POS[2])}
          r={targetExit === "assembly-a" ? 1.5 : 1.1}
          fill={targetExit === "assembly-a" ? "rgba(16, 185, 129, 0.25)" : "none"}
          stroke="#10b981"
          strokeWidth={targetExit === "assembly-a" ? 0.6 : 0.35}
        />
        <text
          x={sx(ASSEMBLY_A_POS[0])}
          y={sy(ASSEMBLY_A_POS[2]) + 2}
          textAnchor="middle"
          fill={targetExit === "assembly-a" ? "#34d399" : "#10b981"}
          fontSize={1.0}
          fontFamily="monospace"
          fontWeight={targetExit === "assembly-a" ? "700" : "400"}
        >
          A
        </text>

        {/* Assembly Beacon B (East) */}
        <circle
          cx={sx(ASSEMBLY_B_POS[0])}
          cy={sy(ASSEMBLY_B_POS[2])}
          r={targetExit === "assembly-b" ? 1.5 : 1.1}
          fill={targetExit === "assembly-b" ? "rgba(16, 185, 129, 0.25)" : "none"}
          stroke="#10b981"
          strokeWidth={targetExit === "assembly-b" ? 0.6 : 0.35}
        />
        <text
          x={sx(ASSEMBLY_B_POS[0])}
          y={sy(ASSEMBLY_B_POS[2]) + 2}
          textAnchor="middle"
          fill={targetExit === "assembly-b" ? "#34d399" : "#10b981"}
          fontSize={1.0}
          fontFamily="monospace"
          fontWeight={targetExit === "assembly-b" ? "700" : "400"}
        >
          B
        </text>

        {/* Evacuee direction indicator */}
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
        {/* Evacuee position dot */}
        <circle ref={evacuee} r={1.05} fill="#38bdf8" stroke="#000" strokeWidth={0.2} />

        {/* Maya Vulnerable Peer Position */}
        <g>
          <circle
            cx={sx(maya.position[0])}
            cy={sy(maya.position[2])}
            r={0.95}
            fill={
              maya.status === "SAFE"
                ? "#22c55e"
                : maya.status === "FOLLOWING"
                  ? "#a855f7"
                  : maya.status === "DISTRESSED"
                    ? "#ef4444"
                    : "#facc15"
            }
            stroke="#000"
            strokeWidth={0.2}
          />
          <text
            x={sx(maya.position[0])}
            y={sy(maya.position[2]) - 1.2}
            textAnchor="middle"
            fill="#c084fc"
            fontSize={0.85}
            fontFamily="monospace"
            fontWeight="700"
          >
            M
          </text>
        </g>
      </svg>
      <div className="mt-1 flex flex-wrap gap-2 text-[9px] text-zinc-500">
        <span className="text-sky-400">● evacuee</span>
        <span className="text-purple-400">● maya</span>
        <span className="text-emerald-400">--- safe route</span>
        {assignedSector && <span className="text-emerald-400">▭ assigned</span>}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-widest text-zinc-600">
        {roomById(evacueeSector).name} / live position
      </div>
    </div>
  );
}
