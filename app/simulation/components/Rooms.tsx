"use client";

import { RigidBody } from "@react-three/rapier";
import { useSimulation } from "../store";
import {
  Cabinet,
  CeilingLight,
  Chair,
  ControlRack,
  Crate,
  Desk,
  GlassCabinet,
  HazardStripe,
  LabBench,
  Locker,
  Monitor,
  Plant,
  ServerRack,
  Shelf,
  StatusLight,
  WallTrim,
  Whiteboard,
  WoodCrate,
} from "./Furniture";
import { Label } from "./Markers";

const ROOM_COLORS = {
  classroom: "#38bdf8",
  workshop: "#a78bfa",
  lab: "#06b6d4",
  chem: "#ef4444",
  exitSafe: "#10b981",
  exitWarn: "#f59e0b",
};

/** Directional emergency exit sign */
function ExitSign({
  position,
  rotationY = 0,
  text,
  arrow = "->",
  color = "#10b981",
}: {
  position: [number, number, number];
  rotationY?: number;
  text: string;
  arrow?: "<-" | "->" | "^";
  color?: string;
}) {
  const showLabel = useSimulation((state) => state.view !== "evacuee");

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Backing box */}
      <mesh castShadow>
        <boxGeometry args={[1.8, 0.45, 0.1]} />
        <meshStandardMaterial color="#0d141c" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Glowing border / face */}
      <mesh position={[0, 0, 0.052]}>
        <planeGeometry args={[1.7, 0.38]} />
        <meshBasicMaterial color="#061c12" />
      </mesh>
      {/* Green indicator bar */}
      <mesh position={[0, 0.14, 0.055]}>
        <planeGeometry args={[1.6, 0.04]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Direction indicator */}
      <mesh position={[arrow === "<-" ? -0.6 : arrow === "->" ? 0.6 : 0, -0.04, 0.055]}>
        <planeGeometry args={[0.25, 0.14]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {showLabel && (
        <Label
          position={[0, 0.4, 0.06]}
          color={color}
          text={`${arrow === "<-" ? "◀ " : ""}${text}${arrow === "->" ? " ▶" : ""}`}
          sub="EMERGENCY EXIT ROUTE"
        />
      )}
    </group>
  );
}

function RoomSign({
  position,
  title,
  code,
  color,
  rotationY = 0,
}: {
  position: [number, number, number];
  title: string;
  code: string;
  color: string;
  rotationY?: number;
}) {
  const showLabel = useSimulation((state) => state.view !== "evacuee");
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[3.2, 0.65, 0.08]} />
        <meshStandardMaterial color="#11161d" roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[-1.2, 0.12, 0.05]}>
        <boxGeometry args={[0.7, 0.04, 0.018]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[-0.1, 0.12, 0.05]}>
        <boxGeometry args={[0.7, 0.04, 0.018]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
      <mesh position={[1.0, 0.12, 0.05]}>
        <boxGeometry args={[0.4, 0.04, 0.018]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      {showLabel && <Label position={[0, 0.02, 0.08]} color={color} text={title} sub={code} />}
    </group>
  );
}

/** Classroom 204 — Navigator spawn area */
function Classroom204() {
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid">
        {/* Teacher podium & desk at front-center */}
        <Desk position={[-15, 0, -4.2]} size={[2.8, 0.75, 1.0]} />
        {/* Student desks - left column */}
        <Desk position={[-18.5, 0, -6.8]} size={[1.8, 0.72, 0.8]} />
        <Desk position={[-18.5, 0, -8.6]} size={[1.8, 0.72, 0.8]} />
        {/* Student desks - right column */}
        <Desk position={[-11.5, 0, -6.8]} size={[1.8, 0.72, 0.8]} />
        <Desk position={[-11.5, 0, -8.6]} size={[1.8, 0.72, 0.8]} />
        {/* Storage along west wall */}
        <Locker position={[-21.4, 0, -6.0]} />
        <Locker position={[-21.4, 0, -7.2]} />
        <Shelf position={[-21.4, 0, -4.0]} />
        <Cabinet position={[-8.6, 0, -8.0]} rotationY={Math.PI} />
      </RigidBody>

      <Chair position={[-15, 0, -3.4]} rotationY={Math.PI} />
      <Chair position={[-18.5, 0, -6.0]} rotationY={0} />
      <Chair position={[-18.5, 0, -7.8]} rotationY={0} />
      <Chair position={[-11.5, 0, -6.0]} rotationY={0} />
      <Chair position={[-11.5, 0, -7.8]} rotationY={0} />

      <Monitor position={[-15, 0.76, -4.2]} scale={0.75} />
      <Whiteboard position={[-15, 2.0, -9.85]} />
      <Plant position={[-8.8, 0, -3.2]} />

      <RoomSign
        position={[-15, 2.7, -9.8]}
        title="CLASSROOM 204"
        code="NAVIGATOR SECTOR / DRILL ORIGIN"
        color={ROOM_COLORS.classroom}
      />
      <RoomSign
        position={[-15, 2.75, -2.1]}
        rotationY={Math.PI}
        title="CLASSROOM 204"
        code="EXIT TO WEST CORRIDOR"
        color={ROOM_COLORS.classroom}
      />

      <WallTrim position={[-15, 0, -9.8]} width={13.6} accent={ROOM_COLORS.classroom} />
      <CeilingLight position={[-18, 3.55, -6]} cast color="#e0f2fe" />
      <CeilingLight position={[-12, 3.55, -6]} color="#e0f2fe" />
    </group>
  );
}

/** Classroom 205 — Vulnerable peer Maya's room */
function Classroom205() {
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid">
        <Desk position={[15, 0, -4.2]} size={[2.8, 0.75, 1.0]} />
        <Desk position={[11.5, 0, -6.8]} size={[1.8, 0.72, 0.8]} />
        <Desk position={[11.5, 0, -8.6]} size={[1.8, 0.72, 0.8]} />
        <Desk position={[18.5, 0, -6.8]} size={[1.8, 0.72, 0.8]} />
        <Desk position={[18.5, 0, -8.6]} size={[1.8, 0.72, 0.8]} />
        <Locker position={[21.4, 0, -6.0]} rotationY={Math.PI} />
        <Shelf position={[21.4, 0, -4.0]} rotationY={Math.PI} />
        <Cabinet position={[8.6, 0, -8.0]} />
      </RigidBody>

      <Chair position={[15, 0, -3.4]} rotationY={Math.PI} />
      <Chair position={[15, 0, -6.0]} rotationY={0} />
      <Monitor position={[15, 0.76, -4.2]} scale={0.75} />
      <Whiteboard position={[15, 2.0, -9.85]} />
      <Plant position={[8.8, 0, -3.2]} />

      <RoomSign
        position={[15, 2.7, -9.8]}
        title="CLASSROOM 205"
        code="STUDENT WORKSPACE / MAYA"
        color={ROOM_COLORS.classroom}
      />
      <RoomSign
        position={[15, 2.75, -2.1]}
        rotationY={Math.PI}
        title="CLASSROOM 205"
        code="EXIT TO EAST CORRIDOR"
        color={ROOM_COLORS.classroom}
      />

      <WallTrim position={[15, 0, -9.8]} width={13.6} accent={ROOM_COLORS.classroom} />
      <CeilingLight position={[12, 3.55, -6]} cast color="#fef3c7" />
      <CeilingLight position={[18, 3.55, -6]} color="#fef3c7" />
    </group>
  );
}

/** Workshop 203 — Engineering fabrication space */
function Workshop203() {
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid">
        <LabBench position={[-4, 0, -6]} width={3.6} />
        <LabBench position={[4, 0, -6]} width={3.6} />
        <WoodCrate position={[-6.8, 0.5, -8.8]} />
        <WoodCrate position={[-5.6, 0.5, -8.8]} />
        <WoodCrate position={[-6.8, 1.5, -8.8]} />
        <Crate position={[6.8, 0.42, -8.8]} size={0.84} color="#6f7a3e" />
        <Cabinet position={[7.2, 0, -4.0]} rotationY={Math.PI} />
      </RigidBody>

      <ControlRack position={[-7.2, 0, -4.0]} color={ROOM_COLORS.workshop} />
      <RoomSign
        position={[0, 2.7, -9.8]}
        title="WORKSHOP 203"
        code="FABRICATION & PROTOTYPING"
        color={ROOM_COLORS.workshop}
      />

      <CeilingLight position={[0, 3.55, -6]} cast color="#f3e8ff" />
    </group>
  );
}

/** Lab 201 — Nanotechnology Research */
function Lab201() {
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid">
        <LabBench position={[-15, 0, 6]} width={5.4} />
        <GlassCabinet position={[-21.2, 0, 6]} />
        <GlassCabinet position={[-8.8, 0, 6]} rotationY={Math.PI} />
      </RigidBody>
      <ServerRack position={[-21.2, 0, 8.5]} color={ROOM_COLORS.lab} />
      <StatusLight position={[-15, 2.2, 9.8]} color="#06b6d4" />
      <RoomSign
        position={[-15, 2.7, 9.8]}
        title="LAB 201 — NANOTECH"
        code="RESEARCH & MATERIALS"
        color={ROOM_COLORS.lab}
      />
      <CeilingLight position={[-15, 3.55, 6]} cast color="#cffafe" />
    </group>
  );
}

/** Lab 202 — Organic Chem / Fire Origin */
function Lab202() {
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid">
        <LabBench position={[-1, 0, 6]} width={5.4} />
        <HazardStripe position={[-1, 0, 2.3]} width={4.2} />
      </RigidBody>
      <ControlRack position={[-7.2, 0, 6]} color="#ef4444" />
      <StatusLight position={[-1, 2.2, 9.8]} color="#ef4444" speed={3.0} />
      <RoomSign
        position={[-1, 2.7, 9.8]}
        title="LAB 202 — ORGANIC CHEM"
        code="HAZARD ORIGIN / FIRE INCIDENT"
        color={ROOM_COLORS.chem}
      />
      <pointLight position={[-1, 2.4, 6]} intensity={0.8} distance={8} color="#f97316" />
      <CeilingLight position={[-1, 3.55, 6]} cast color="#fee2e2" />
    </group>
  );
}

/** Chemical Store & Prep Room */
function ChemWing() {
  return (
    <group>
      <RigidBody type="fixed" colliders="cuboid">
        <Shelf position={[6.8, 0, 6]} rotationY={Math.PI / 2} />
        <GlassCabinet position={[13.2, 0, 6]} rotationY={-Math.PI / 2} />
        <LabBench position={[18, 0, 6]} width={4.5} />
      </RigidBody>
      <Crate position={[10, 0.42, 8.5]} size={0.84} color="#78350f" />
      <StatusLight position={[10, 2.2, 9.8]} color="#f59e0b" />
      <RoomSign
        position={[10, 2.7, 9.8]}
        title="CHEMICAL STORE"
        code="FLAMMABLE REAGENTS"
        color={ROOM_COLORS.chem}
      />
      <RoomSign
        position={[18, 2.7, 9.8]}
        title="PREP ROOM"
        code="GLASSWARE & REAGENTS"
        color={ROOM_COLORS.lab}
      />
      <CeilingLight position={[10, 3.55, 6]} color="#fef3c7" />
      <CeilingLight position={[18, 3.55, 6]} color="#e0f2fe" />
    </group>
  );
}

/** Central Corridor & Junction Signage */
function CorridorSignage() {
  return (
    <group>
      {/* Central Junction overhead signs */}
      <ExitSign
        position={[-2.5, 2.8, 0]}
        rotationY={Math.PI / 2}
        text="FIRE EXIT A (WEST)"
        arrow="<-"
        color={ROOM_COLORS.exitSafe}
      />
      <ExitSign
        position={[2.5, 2.8, 0]}
        rotationY={-Math.PI / 2}
        text="FIRE EXIT B (EAST)"
        arrow="->"
        color={ROOM_COLORS.exitWarn}
      />

      {/* West Corridor Exit Sign leading into Stairwell */}
      <ExitSign
        position={[-20, 2.8, 1.8]}
        rotationY={0}
        text="EXIT A -> COURTYARD"
        arrow="^"
        color={ROOM_COLORS.exitSafe}
      />

      {/* East Corridor Exit Sign leading into Stairwell */}
      <ExitSign
        position={[20, 2.8, 1.8]}
        rotationY={0}
        text="EXIT B -> EAST QUAD"
        arrow="^"
        color={ROOM_COLORS.exitWarn}
      />

      {/* West Stairwell Exterior Exit Sign above outer doorway */}
      <ExitSign
        position={[-20, 2.8, 13.8]}
        rotationY={0}
        text="FIRE EXIT A -> ASSEMBLY POINT"
        arrow="^"
        color={ROOM_COLORS.exitSafe}
      />

      {/* East Stairwell Exterior Exit Sign above outer doorway */}
      <ExitSign
        position={[20, 2.8, 13.8]}
        rotationY={0}
        text="FIRE EXIT B -> ASSEMBLY POINT"
        arrow="^"
        color={ROOM_COLORS.exitSafe}
      />

      {/* Corridor ceiling lights along the spine */}
      {[-18, -12, -6, 0, 6, 12, 18].map((x) => (
        <CeilingLight key={x} position={[x, 3.55, 0]} color="#f1f5f9" />
      ))}
      {/* Stairwell ceiling lights */}
      <CeilingLight position={[-20, 3.55, 8]} color="#dcfce7" />
      <CeilingLight position={[20, 3.55, 8]} color="#fef2f2" />
    </group>
  );
}

export default function Rooms() {
  return (
    <>
      <Classroom204 />
      <Classroom205 />
      <Workshop203 />
      <Lab201 />
      <Lab202 />
      <ChemWing />
      <CorridorSignage />
    </>
  );
}
