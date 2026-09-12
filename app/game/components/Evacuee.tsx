"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { CapsuleCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { EVACUEE_SPAWN, roomAt } from "../level";
import { pressJump, pressUse } from "../controls";
import { clampDt, runtime } from "../runtime";
import { useSession } from "../session";
import { useGame, useIsSimulationOwner } from "../store";
import { Label, NeonBox } from "./Markers";

export type Controls =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "sprint"
  | "use"
  | "jump";

const WALK = 3.6;
const RUN = 5.8;
const JUMP_V = 6.2;
const GROUNDED_Y = 0.95;
const JUMP_BUFFER_MS = 160;
const EYE = 0.8;

function EvacueeFigure() {
  return (
    <group>
      <mesh position={[-0.13, 0.35, 0]}>
        <boxGeometry args={[0.2, 0.7, 0.24]} />
        <meshStandardMaterial color="#1b1c20" roughness={0.9} />
      </mesh>
      <mesh position={[0.13, 0.35, 0]}>
        <boxGeometry args={[0.2, 0.7, 0.24]} />
        <meshStandardMaterial color="#1b1c20" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.03, 0]}>
        <boxGeometry args={[0.56, 0.72, 0.3]} />
        <meshStandardMaterial color="#101318" roughness={0.9} />
      </mesh>
      <mesh position={[-0.36, 1.03, 0]}>
        <boxGeometry args={[0.16, 0.66, 0.22]} />
        <meshStandardMaterial color="#101318" roughness={0.9} />
      </mesh>
      <mesh position={[0.36, 1.03, 0]}>
        <boxGeometry args={[0.16, 0.66, 0.22]} />
        <meshStandardMaterial color="#101318" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.57, 0]}>
        <boxGeometry args={[0.36, 0.38, 0.34]} />
        <meshStandardMaterial color="#38bdf8" roughness={0.75} />
      </mesh>
    </group>
  );
}

function HeadingBeacon() {
  return (
    <group position={[0, 2.35, 0]}>
      <mesh position={[0, 0, 0.27]}>
        <boxGeometry args={[0.045, 0.045, 0.48]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>
      <mesh position={[0, 0, 0.62]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.14, 0.28, 4]} />
        <meshBasicMaterial color="#facc15" />
      </mesh>
    </group>
  );
}

export function ContactShade() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <circleGeometry args={[0.5, 20]} />
      <meshBasicMaterial color="#05070a" transparent opacity={0.3} />
    </mesh>
  );
}

function LocalEvacuee() {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const eyeTarget = useRef(new THREE.Vector3());
  const bobT = useRef(0);
  const [sub, get] = useKeyboardControls<Controls>();
  const view = useGame((state) => state.view);
  const air = useGame((state) => state.air);
  const resetSeq = useGame((state) => state.resetSeq);
  const firstPerson = view === "evacuee";

  useEffect(
    () =>
      sub(
        (state) => state.use,
        (pressed) => pressed && pressUse(),
      ),
    [sub],
  );

  useEffect(
    () =>
      sub(
        (state) => state.jump,
        (pressed) => pressed && pressJump(),
      ),
    [sub],
  );

  useEffect(() => {
    const rb = body.current;
    if (!rb) return;
    rb.setTranslation(
      { x: EVACUEE_SPAWN[0], y: EVACUEE_SPAWN[1], z: EVACUEE_SPAWN[2] },
      true,
    );
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    eyeTarget.current.set(EVACUEE_SPAWN[0], EVACUEE_SPAWN[1] + EYE, EVACUEE_SPAWN[2]);
  }, [resetSeq]);

  useFrame((state, rawDt) => {
    const rb = body.current;
    if (!rb) return;
    const dt = clampDt(rawDt);
    const t = rb.translation();
    runtime.evacuee.set(t.x, t.y, t.z);
    runtime.sector = roomAt(t.x, t.z);

    const down = air > 0 ? get() : ({} as Record<Controls, boolean>);
    const stick = air > 0 ? runtime.touchMove : { x: 0, y: 0 };
    const forward = THREE.MathUtils.clamp(
      (down.forward ? 1 : 0) - (down.back ? 1 : 0) + stick.y,
      -1,
      1,
    );
    const right = THREE.MathUtils.clamp(
      (down.right ? 1 : 0) - (down.left ? 1 : 0) + stick.x,
      -1,
      1,
    );

    const direction = state.camera.getWorldDirection(new THREE.Vector3());
    direction.y = 0;
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, -1);
    direction.normalize();
    const side = new THREE.Vector3().crossVectors(
      direction,
      new THREE.Vector3(0, 1, 0),
    );
    const move = new THREE.Vector3()
      .addScaledVector(direction, forward)
      .addScaledVector(side, right);
    const moving = move.lengthSq() > 1e-4;
    const throttle = Math.min(1, move.length());
    if (moving) move.normalize();

    const speed = (down.sprint ? RUN : WALK) * (moving ? throttle : 0);
    const velocity = rb.linvel();
    const grounded = t.y <= GROUNDED_Y;
    const wantsJump = performance.now() - runtime.jumpAt < JUMP_BUFFER_MS;
    if (wantsJump && grounded && air > 0) runtime.jumpAt = -1e9;
    rb.setLinvel(
      {
        x: move.x * speed,
        y: wantsJump && grounded && air > 0 ? JUMP_V : velocity.y,
        z: move.z * speed,
      },
      true,
    );

    if (firstPerson) runtime.evacueeYaw = Math.atan2(direction.x, direction.z);
    else if (moving) runtime.evacueeYaw = Math.atan2(move.x, move.z);
    if (visual.current) {
      visual.current.rotation.y = runtime.evacueeYaw;
      bobT.current += moving ? dt * (down.sprint ? 12 : 8) : 0;
      visual.current.position.y = moving ? Math.abs(Math.sin(bobT.current)) * 0.05 : 0;
    }

    if (firstPerson) {
      eyeTarget.current.set(
        t.x,
        t.y + EYE + (moving ? Math.sin(bobT.current * 2) * 0.02 : 0),
        t.z,
      );
      state.camera.position.lerp(eyeTarget.current, 1 - Math.exp(-dt * 14));
    }
  });

  return (
    <RigidBody
      ref={body}
      type="dynamic"
      colliders={false}
      position={EVACUEE_SPAWN}
      enabledRotations={[false, false, false]}
      friction={0}
      linearDamping={6}
      mass={1}
      ccd
      userData={{ tag: "evacuee" }}
    >
      <CapsuleCollider args={[0.5, 0.32] as [number, number]} />
      <group ref={visual} position={[0, -0.85, 0]} visible={!firstPerson}>
        <EvacueeFigure />
        <ContactShade />
        {!firstPerson && <HeadingBeacon />}
      </group>
      {!firstPerson && (
        <group position={[0, 0, 0]}>
          <NeonBox
            position={[0, 0.95, 0]}
            size={[0.85, 1.9, 0.55]}
            color={air <= 0 ? "#ef4444" : "#38bdf8"}
            opacity={0.07}
          />
          <Label
            position={[0, 2.25, 0]}
            color={air <= 0 ? "#ef4444" : "#38bdf8"}
            text={air <= 0 ? "Evacuee (down)" : "Evacuee"}
          />
        </group>
      )}
    </RigidBody>
  );
}

function RemoteEvacuee() {
  const group = useRef<THREE.Group>(null);
  const mode = useGame((state) => state.mode);
  const evacueeSector = useGame((state) => state.sector);
  const assigned = mode.kind === "warden" ? mode.sectorId : null;
  const inAssignedSector = assigned !== null && evacueeSector === assigned;
  const onWardenState = useSession((state) => state.onWardenState);

  useEffect(() => {
    return onWardenState((state) => {
      if (!state.evacuee) {
        runtime.netEvacuee = null;
        return;
      }
      runtime.netEvacuee = {
        x: state.evacuee.position[0],
        y: state.evacuee.position[1],
        z: state.evacuee.position[2],
        yaw: state.evacuee.position[3],
      };
      runtime.sector = state.evacuee.sectorId;
      runtime.alert = state.smokeIntensity * 100;
    });
  }, [onWardenState]);

  useFrame((_, rawDt) => {
    const current = runtime.netEvacuee;
    const target = group.current;
    if (!target) return;
    target.visible = inAssignedSector && !!current;
    if (!current) return;
    const factor = Math.min(1, clampDt(rawDt) * 9);
    runtime.evacuee.lerp(new THREE.Vector3(current.x, current.y, current.z), factor);
    runtime.evacueeYaw +=
      (((current.yaw - runtime.evacueeYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * factor;
    target.position.set(runtime.evacuee.x, runtime.evacuee.y - 0.85, runtime.evacuee.z);
    target.rotation.y = runtime.evacueeYaw;
  });

  return (
    <group ref={group} visible={false}>
      <EvacueeFigure />
      <ContactShade />
      <HeadingBeacon />
      {inAssignedSector && (
        <>
          <NeonBox position={[0, 0.95, 0]} size={[0.85, 1.9, 0.55]} color="#38bdf8" opacity={0.07} />
          <Label position={[0, 2.25, 0]} color="#38bdf8" text="Evacuee" />
        </>
      )}
    </group>
  );
}

export default function Evacuee() {
  const ownsSimulation = useIsSimulationOwner();
  return ownsSimulation ? <LocalEvacuee /> : <RemoteEvacuee />;
}
