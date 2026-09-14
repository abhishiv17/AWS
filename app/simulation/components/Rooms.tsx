"use client";

import { RigidBody } from "@react-three/rapier";
import {
  Cabinet,
  CeilingBeam,
  CeilingLight,
  Chair,
  ClassroomRows,
  ClassroomPodium,
  ClimbableStack,
  ControlRack,
  Crate,
  CeilingPipes,
  Desk,
  FumeHood,
  FloorMark,
  GlassCabinet,
  HazardStripe,
  LabBench,
  LightBar,
  Locker,
  Monitor,
  MonitorBank,
  MicroscopeStation,
  Plant,
  Reception,
  ServerRack,
  Shelf,
  Sofa,
  StatusLight,
  WallPanel,
  WaterCooler,
  WallClock,
  WallTrim,
  WindowBay,
  Whiteboard,
  WoodCrate,
} from "./Furniture";
import { Label } from "./Markers";

const ROOM_COLORS = {
  lobby: "#38bdf8",
  utility: "#10b981",
  dorm: "#facc15",
};

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
  const showLabel = true;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[3.5, 0.72, 0.08]} />
        <meshStandardMaterial color="#11161d" roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[-1.3, 0.14, 0.05]}>
        <boxGeometry args={[0.85, 0.05, 0.018]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[-0.1, 0.14, 0.05]}>
        <boxGeometry args={[0.85, 0.05, 0.018]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
      <mesh position={[1.1, 0.14, 0.05]}>
        <boxGeometry args={[0.45, 0.05, 0.018]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      {showLabel && <Label position={[0, 0.02, 0.08]} color={color} text={title} sub={code} />}
    </group>
  );
}

function RoomEdgeLights({
  color,
  z,
  cx = 0,
  count = 5,
}: {
  color: string;
  z: number;
  cx?: number;
  count?: number;
}) {
  return (
    <group>
      {Array.from({ length: count }, (_, index) => (
        <LightBar key={index} position={[cx - 4.2 + index * 2.1, 0.08, z]} width={1.05} color={color} />
      ))}
    </group>
  );
}

/** Every role renders every room; the warden camera follows the evacuee through all of them. */
function RoomContents({
  children,
}: {
  room: "lobby" | "sec" | "vault";
  children: React.ReactNode;
}) {
  return <group>{children}</group>;
}

function PortalFrame({
  position,
  label,
  color,
  rotationY = 0,
}: {
  position: [number, number, number];
  label: string;
  color: string;
  rotationY?: number;
}) {
  const showLabel = true;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[-0.95, 1.3, 0]} castShadow>
        <boxGeometry args={[0.12, 2.6, 0.2]} />
        <meshStandardMaterial color="#383d44" roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[0.95, 1.3, 0]} castShadow>
        <boxGeometry args={[0.12, 2.6, 0.2]} />
        <meshStandardMaterial color="#383d44" roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[0, 2.58, 0]}>
        <boxGeometry args={[2.02, 0.12, 0.2]} />
        <meshStandardMaterial color="#383d44" roughness={0.7} metalness={0.25} />
      </mesh>
      <LightBar position={[-0.52, 2.58, 0.13]} width={0.55} color={color} />
      <LightBar position={[0.52, 2.58, 0.13]} width={0.55} color={color} />
      {showLabel && <Label position={[0, 2.98, 0.08]} color={color} text={label} sub="connected passage" />}
    </group>
  );
}

function Foyer() {
  return (
    <RoomContents room="lobby">
      <RigidBody type="fixed" colliders="cuboid">
        <Reception position={[-2.6, 0, 5]} />
        <Sofa position={[3.9, 0, 4.2]} rotationY={-Math.PI / 2} />
        <mesh position={[0, 0.22, -1.2]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.44, 1.6]} />
          <meshStandardMaterial color="#3f434a" roughness={0.8} />
        </mesh>
      </RigidBody>
      <Plant position={[0, 0.44, -1.2]} scale={1.25} />
      <Plant position={[-4.7, 0, 6.2]} />
      <Plant position={[4.7, 0, 6.2]} />
      <Plant position={[-4.7, 0, -6.2]} />
      <Plant position={[4.7, 0, -6.2]} />
      <Monitor position={[-3.9, 1.19, 4.7]} rotationY={0.2} scale={0.7} />
      <RoomSign position={[0, 2.82, -6.82]} title="CENTRAL ENTRANCE" code="CORRIDOR / START POINT" color={ROOM_COLORS.lobby} />
      <WallTrim position={[0, 0, -6.72]} width={9.8} accent={ROOM_COLORS.lobby} />
      <CeilingBeam position={[0, 3.34, 1.5]} width={9.8} />
      <CeilingBeam position={[0, 3.34, -3.8]} width={9.8} />
      <WallPanel position={[3.75, 0, -6.72]} width={1.8} color={ROOM_COLORS.lobby} />
      <Label position={[0, 2.24, -6.9]} color="#dcecff" text="CAMPUS EVAC" sub="READ THE SIGNS / STAY TOGETHER" />
      <RoomEdgeLights color={ROOM_COLORS.lobby} z={-6.68} />
      <FloorMark position={[0, 0, 0.2]} size={[7.4, 0.08]} color={ROOM_COLORS.lobby} opacity={0.3} />
      <PortalFrame position={[-5.62, 0, 2.5]} label="SCIENCE BLOCK" color={ROOM_COLORS.utility} rotationY={Math.PI / 2} />
      <PortalFrame position={[5.62, 0, 2.5]} label="ACADEMIC BLOCK" color={ROOM_COLORS.dorm} rotationY={-Math.PI / 2} />
      <group position={[0, 2.5, -6.8]}>
        <mesh>
          <boxGeometry args={[3, 0.7, 0.06]} />
          <meshStandardMaterial color="#22262c" roughness={0.6} />
        </mesh>
        <mesh position={[-0.75, 0, 0.04]}>
          <planeGeometry args={[1.2, 0.16]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh position={[0.78, 0, 0.04]}>
          <planeGeometry args={[1.2, 0.16]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      </group>
      <CeilingLight position={[0, 3.55, 4.2]} cast color="#d9e8ff" />
      <CeilingLight position={[0, 3.55, -0.5]} color="#d9e8ff" />
      <CeilingLight position={[0, 3.55, -5.2]} color="#d9e8ff" />
      <pointLight position={[0, 2.4, -6.1]} intensity={0.45} distance={8} decay={2} color="#2d6bff" />
    </RoomContents>
  );
}

function UtilityRoom() {
  return (
    <RoomContents room="sec">
      <RigidBody type="fixed" colliders="cuboid">
        <Desk position={[-15, 0, -5.9]} size={[5.2, 0.75, 1.1]} />
        <Desk position={[-9.6, 0, 2.6]} size={[1.8, 0.72, 0.9]} rotationY={0.2} />
        <Locker position={[-21.5, 0, -5.2]} />
        <Locker position={[-21.5, 0, -3.9]} />
        <Shelf position={[-21.5, 0, 0.4]} />
        <Cabinet position={[-8.6, 0, -4.4]} rotationY={Math.PI} />
        <Cabinet position={[-8.6, 0, -3.5]} rotationY={Math.PI} />
        <LabBench position={[-15, 0, -1.8]} width={5.7} />
        <GlassCabinet position={[-20.8, 0, -1.7]} />
        <GlassCabinet position={[-9.25, 0, -1.7]} rotationY={Math.PI} />
      </RigidBody>
      <WaterCooler position={[-20.6, 0, 4.8]} />
      <MonitorBank position={[-15, 0.79, -5.75]} />
      <Chair position={[-15, 0, -4.6]} rotationY={Math.PI} />
      <Monitor position={[-9.6, 0.76, 2.6]} rotationY={Math.PI + 0.2} scale={0.8} />
      <Whiteboard position={[-18.4, 2.1, -6.8]} />
      <FumeHood position={[-11.25, 0, -5.85]} accent="#ff6b72" />
      <MicroscopeStation position={[-16.25, 0, -1.8]} />
      <MicroscopeStation position={[-14.1, 0, -1.8]} rotationY={0.15} />
      <WindowBay position={[-21.82, 0, 3.0]} rotationY={Math.PI / 2} accent="#55c7ff" />
      <CeilingPipes position={[-15, 3.22, -3.65]} length={11.5} color="#5a727d" />
      <CeilingPipes position={[-19.2, 3.22, 2.5]} length={6.5} rotationY={Math.PI / 2} color="#48636d" />
      <Label position={[-11.25, 2.75, -5.24]} color="#ff8b88" text="FUME HOOD" sub="VENTILATION / GAS CONTROL" />
      <Label position={[-15, 1.42, -1.1]} color="#a9e8e7" text="CHEMISTRY WORKSTATIONS" sub="CHECK THE BENCHES" />
      <Plant position={[-8.9, 0, 5.6]} />
      <Crate position={[-19.4, 0.42, 6.2]} size={0.84} color="#6f7a3e" />
      <Crate position={[-18.5, 0.42, 6.2]} size={0.84} color="#6f7a3e" />
      <StatusLight position={[-15, 1.62, -6.4]} color="#10b981" />
      <RoomSign position={[-15, 2.82, -6.82]} title="SCIENCE BLOCK" code="CHEMISTRY LAB 1A / L1" color={ROOM_COLORS.utility} />
      <WallTrim position={[-15, 0, -6.72]} width={12.8} accent={ROOM_COLORS.utility} />
      <CeilingBeam position={[-15, 3.34, -1.5]} width={12.5} />
      <CeilingBeam position={[-15, 3.34, 4.8]} width={12.5} />
      <WallPanel position={[-10.15, 0, -6.72]} width={2.2} color={ROOM_COLORS.utility} />
      <HazardStripe position={[-15, 0, 5.8]} width={5.5} />
      <ClimbableStack position={[-12.4, 0, 5.35]} color="#65733d" height={2} />
      <ControlRack position={[-20.8, 0, -5.9]} color={ROOM_COLORS.utility} />
      <ControlRack position={[-19.8, 0, -5.9]} color="#ef4444" />
      <ServerRack position={[-20.8, 0, 1.1]} color={ROOM_COLORS.utility} />
      <ServerRack position={[-19.8, 0, 1.1]} color={ROOM_COLORS.utility} />
      <ServerRack position={[-18.8, 0, 1.1]} color="#ef4444" />
      <RoomEdgeLights color={ROOM_COLORS.utility} z={-6.68} cx={-15} />
      <FloorMark position={[-15, 0, 1]} size={[0.1, 9.5]} color={ROOM_COLORS.utility} opacity={0.3} />
      <CeilingLight position={[-18.5, 3.55, -3.5]} cast color="#d6ffe8" />
      <CeilingLight position={[-11.5, 3.55, -3.5]} color="#d6ffe8" />
      <CeilingLight position={[-15, 3.55, -5.6]} color="#d6ffe8" />
      <CeilingLight position={[-15, 3.55, 3.5]} color="#d6ffe8" />
      <pointLight position={[-15, 2.5, -6.2]} intensity={0.55} distance={9} decay={2} color="#10b981" />
      <pointLight position={[-15, 2.1, 4.5]} intensity={0.35} distance={7} decay={2} color="#ef4444" />
    </RoomContents>
  );
}

function DormRoom() {
  return (
    <RoomContents room="vault">
      <RigidBody type="fixed" colliders="cuboid">
        <WoodCrate position={[20.7, 0.5, 4.3]} />
        <WoodCrate position={[20.7, 1.5, 4.3]} />
        <WoodCrate position={[19.5, 0.5, 4.9]} />
        <Desk position={[10.6, 0, 4.3]} size={[1.7, 0.75, 0.9]} />
        <Locker position={[21.4, 0, -4.4]} />
        <Locker position={[21.4, 0, -3.1]} />
        <Cabinet position={[8.6, 0, -4.4]} />
        <Crate position={[8.9, 0.42, 5.4]} size={0.84} color="#5f6a3a" />
      </RigidBody>
      <Plant position={[9, 0, 6.2]} />
      <StatusLight position={[17.6, 1.95, -6.7]} color="#facc15" speed={2.4} />
      <RoomSign position={[15, 2.82, 6.82]} rotationY={Math.PI} title="ACADEMIC BLOCK" code="CLASSROOM A201 / L2" color={ROOM_COLORS.dorm} />
      <WallTrim position={[15, 0, 6.72]} width={12.8} rotationY={Math.PI} accent={ROOM_COLORS.dorm} />
      <CeilingBeam position={[15, 3.34, -1.5]} width={12.5} rotationY={Math.PI} />
      <CeilingBeam position={[15, 3.34, 4.8]} width={12.5} rotationY={Math.PI} />
      <WallPanel position={[9.2, 0, 6.72]} width={1.8} color={ROOM_COLORS.dorm} rotationY={Math.PI} />
      <ClassroomRows position={[15, 0, -1.2]} />
      <ClassroomPodium position={[15, 0, 5.05]} rotationY={Math.PI} />
      <WindowBay position={[21.82, 0, 3.0]} rotationY={-Math.PI / 2} accent="#ffd45c" />
      <WallClock position={[21.78, 2.45, -4.85]} rotationY={-Math.PI / 2} />
      <CeilingPipes position={[15, 3.22, -3.55]} length={11.5} color="#756b61" />
      <CeilingPipes position={[19.2, 3.22, 2.5]} length={6.5} rotationY={Math.PI / 2} color="#756b61" />
      <Label position={[15, 2.9, 6.65]} color="#fff1b2" text="A201 / BRIEFING ROOM" sub="DECODE THE ACADEMIC GUIDE" />
      <Whiteboard position={[15, 2.1, 6.8]} rotationY={Math.PI} />
      <ClimbableStack position={[19.6, 0, 4.8]} color="#72563a" height={2} />
      <FloorMark position={[15, 0, 1.5]} size={[0.12, 8.2]} color={ROOM_COLORS.dorm} opacity={0.3} />
      <FloorMark position={[15, 0, -5.2]} size={[5.4, 0.12]} color={ROOM_COLORS.dorm} opacity={0.55} />
      <RoomEdgeLights color={ROOM_COLORS.dorm} z={6.68} cx={15} />
      <CeilingLight position={[11.5, 3.55, -3]} cast color="#fff0c2" />
      <CeilingLight position={[18.5, 3.55, -3]} color="#fff0c2" />
      <CeilingLight position={[15, 3.55, -5.5]} color="#fff0c2" />
      <CeilingLight position={[15, 3.55, 3.5]} color="#fff0c2" />
      <pointLight position={[15, 2.2, -6.3]} intensity={0.65} distance={9} decay={2} color="#f59e0b" />
    </RoomContents>
  );
}

function Entrance() {
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.05, 1.3, 10.5]} rotation={[0, side * 0.5, 0]} castShadow>
          <boxGeometry args={[1.35, 2.5, 0.07]} />
          <meshStandardMaterial color="#9fd2e6" transparent opacity={0.25} roughness={0.1} metalness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 0.015, 9.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 1.6]} />
        <meshStandardMaterial color="#33363b" roughness={1} />
      </mesh>
      <CeilingLight position={[0, 3.4, 8.8]} intensity={7} />
    </group>
  );
}

export default function Rooms() {
  return (
    <>
      <Entrance />
      <Foyer />
      <UtilityRoom />
      <DormRoom />
    </>
  );
}
