"use client";

import { useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { ASSEMBLY_A_POS, ASSEMBLY_B_POS, type Vec3 } from "../level";
import { useSimulation } from "../store";
import { Label } from "./Markers";

function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color("#070b14") },
          bottom: { value: new THREE.Color("#1d2a3a") },
        },
        vertexShader: `
          varying vec3 vP;
          void main() {
            vP = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vP;
          uniform vec3 top;
          uniform vec3 bottom;
          void main() {
            float h = normalize(vP).y * 0.5 + 0.5;
            gl_FragColor = vec4(mix(bottom, top, smoothstep(0.42, 0.9, h)), 1.0);
          }
        `,
      }),
    [],
  );

  return (
    <mesh material={mat} scale={[1, 1, 1]}>
      <sphereGeometry args={[120, 32, 20]} />
    </mesh>
  );
}

function StreetLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 4.4, 8]} />
        <meshStandardMaterial color="#2b2f35" roughness={0.8} />
      </mesh>
      <mesh position={[0, 4.45, 0]}>
        <boxGeometry args={[0.7, 0.16, 0.35]} />
        <meshStandardMaterial
          color="#e8e4d6"
          emissive="#ffe9bb"
          emissiveIntensity={1.4}
        />
      </mesh>
      <pointLight
        position={[0, 4.2, 0]}
        intensity={16}
        distance={18}
        decay={2}
        color="#ffe2b0"
      />
    </group>
  );
}

function Planter({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.6, 1.1]} />
        <meshStandardMaterial color="#4b4f54" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[
            Math.cos(i * 1.7) * 0.22,
            0.85 + (i % 2) * 0.18,
            Math.sin(i * 1.7) * 0.22,
          ]}
          rotation={[0.35 * Math.cos(i), i, 0.35 * Math.sin(i)]}
          castShadow
        >
          <boxGeometry args={[0.5, 0.06, 0.2]} />
          <meshStandardMaterial color="#2f6a3f" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** Rough city silhouette so the facility does not float in a void. */
function Skyline() {
  const blocks = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] =
      [];
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 52 + rnd() * 26;
      const h = 7 + rnd() * 26;
      const w = 6 + rnd() * 9;
      out.push({
        pos: [Math.cos(a) * r, h / 2, Math.sin(a) * r],
        size: [w, h, w],
      });
    }
    return out;
  }, []);

  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial
            color="#0f151d"
            emissive="#131c28"
            emissiveIntensity={0.5}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

/** A single assembly beacon ring + label. */
function Beacon({ position, label }: { position: Vec3; label: string }) {
  const view = useSimulation((s) => s.view);
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.5, 1.8, 40]} />
        <meshBasicMaterial color="#39ff88" transparent opacity={0.5} />
      </mesh>
      <Label
        position={[0, 1.2, 0]}
        color="#10b981"
        text={label}
        faint={view === "evacuee"}
      />
    </group>
  );
}

/** Two assembly beacons — one at each fire-exit courtyard. */
function AssemblyBeacons() {
  return (
    <>
      <Beacon position={ASSEMBLY_A_POS} label="Assembly A (West)" />
      <Beacon position={ASSEMBLY_B_POS} label="Assembly B (East)" />
    </>
  );
}

export default function Exterior() {
  const evacueeView = useSimulation((s) => s.view === "evacuee");

  return (
    <>
      <Sky />

      {/* ground + an invisible perimeter so nobody walks into the void */}
      <RigidBody type="fixed" colliders={false}>
        <mesh position={[0, -0.14, 6]} receiveShadow>
          <boxGeometry args={[220, 0.24, 220]} />
          <meshStandardMaterial color="#22262b" roughness={1} />
        </mesh>
        <CuboidCollider position={[0, -0.25, 6]} args={[110, 0.25, 110]} />
        <CuboidCollider position={[0, 3, 30]} args={[40, 4, 0.5]} />
        <CuboidCollider position={[0, 3, -18]} args={[40, 4, 0.5]} />
        <CuboidCollider position={[-32, 3, 6]} args={[0.5, 4, 40]} />
        <CuboidCollider position={[32, 3, 6]} args={[0.5, 4, 40]} />
      </RigidBody>

      {/* West Courtyard Plaza & Walkway (Exit A -> Assembly Point A) */}
      <mesh position={[-20, 0.02, 18]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#353a38" roughness={0.95} />
      </mesh>

      {/* East Quad Plaza & Walkway (Exit B -> Assembly Point B) */}
      <mesh position={[20, 0.02, 18]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#38353a" roughness={0.95} />
      </mesh>

      {/* Exit A (West) Canopy & Sign */}
      <group visible={evacueeView}>
        <mesh position={[-20, 3.3, 14.5]} castShadow>
          <boxGeometry args={[4.2, 0.2, 1.6]} />
          <meshStandardMaterial color="#2d3532" roughness={0.8} />
        </mesh>
      </group>
      <mesh position={[-20, 3.8, 14.1]}>
        <boxGeometry args={[3.2, 0.45, 0.1]} />
        <meshStandardMaterial
          color="#0b1712"
          emissive="#10b981"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* Exit B (East) Canopy & Sign */}
      <group visible={evacueeView}>
        <mesh position={[20, 3.3, 14.5]} castShadow>
          <boxGeometry args={[4.2, 0.2, 1.6]} />
          <meshStandardMaterial color="#352d2d" roughness={0.8} />
        </mesh>
      </group>
      <mesh position={[20, 3.8, 14.1]}>
        <boxGeometry args={[3.2, 0.45, 0.1]} />
        <meshStandardMaterial
          color="#170b0b"
          emissive="#ef4444"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* Courtyard Planters & Streetlamps */}
      <Planter position={[-23, 0, 17]} />
      <Planter position={[-17, 0, 17]} />
      <Planter position={[17, 0, 17]} />
      <Planter position={[23, 0, 17]} />

      <StreetLamp position={[-20, 0, 24]} />
      <StreetLamp position={[-24, 0, 19]} />
      <StreetLamp position={[20, 0, 24]} />
      <StreetLamp position={[24, 0, 19]} />

      {/* Bollards along courtyard edges */}
      {[-23, -17, 17, 23].map((x) => (
        <mesh key={x} position={[x, 0.45, 23.5]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 0.9, 8]} />
          <meshStandardMaterial color="#4a4f55" roughness={0.8} />
        </mesh>
      ))}

      <Skyline />
      <AssemblyBeacons />
      <directionalLight
        position={[24, 30, 26]}
        intensity={0.48}
        color="#9fb6d8"
      />
      <directionalLight
        position={[-20, 16, -24]}
        intensity={0.22}
        color="#7f93b5"
      />
    </>
  );
}
