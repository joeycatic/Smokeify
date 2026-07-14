"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  Line,
  OrbitControls,
} from "@react-three/drei";
import * as THREE from "three";
import type {
  GrowTentViewerProductProps,
  TentHotspotProduct,
} from "@/components/three/growTentViewerTypes";

const TENT_WIDTH = 0.8;
const TENT_DEPTH = 0.8;
const TENT_HEIGHT = 1.6;

const EXHAUST_X = TENT_WIDTH * 0.28;
const EXHAUST_Z = -TENT_DEPTH * 0.28;
const FILTER_TOP = TENT_HEIGHT - 0.04;
const FILTER_HEIGHT = 0.2;
const FILTER_BOTTOM = FILTER_TOP - FILTER_HEIGHT;
const FAN_Y = FILTER_BOTTOM - 0.09;
const WALL_Z = -TENT_DEPTH / 2;
const DUCT_EXTERIOR_LENGTH = 0.18;
const DUCT_EXIT_Z = WALL_Z - DUCT_EXTERIOR_LENGTH;

const GROWTH_STAGES = [
  { label: "Sämling", value: 0 },
  { label: "Vegetativ", value: 0.35 },
  { label: "Blüte", value: 0.7 },
  { label: "Erntereif", value: 1 },
] as const;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function createBrushedMetalTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#9aa19c";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 600; i += 1) {
    const y = Math.random() * 128;
    const shade = 130 + Math.random() * 90;
    ctx.strokeStyle = `rgba(${shade},${shade},${shade},${0.08 + Math.random() * 0.14})`;
    ctx.lineWidth = 0.5 + Math.random() * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y + (Math.random() - 0.5) * 5);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 10);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createDiamondPlateTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#cdd1cc";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  const step = 16;
  for (let y = 0; y < 128; y += step) {
    for (let x = 0; x < 128; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y + step / 2);
      ctx.lineTo(x + step / 2, y);
      ctx.lineTo(x + step, y + step / 2);
      ctx.lineTo(x + step / 2, y + step);
      ctx.closePath();
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMeshVentTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#000000";
  const step = 6;
  for (let y = 0; y < 64; y += step) {
    for (let x = 0; x < 64; x += step) {
      ctx.fillRect(x, y, step - 2, step - 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 4);
  return texture;
}

function useProceduralTextures() {
  return useMemo(
    () => ({
      metal: createBrushedMetalTexture(),
      floor: createDiamondPlateTexture(),
      vent: createMeshVentTexture(),
    }),
    [],
  );
}

function TentFrame({ metalTexture }: { metalTexture: THREE.Texture | null }) {
  const poleMaterial = (
    <meshStandardMaterial
      color="#c7ccc9"
      metalness={0.75}
      roughness={0.32}
      roughnessMap={metalTexture}
    />
  );
  const corners: Array<[number, number]> = [
    [-TENT_WIDTH / 2, -TENT_DEPTH / 2],
    [TENT_WIDTH / 2, -TENT_DEPTH / 2],
    [TENT_WIDTH / 2, TENT_DEPTH / 2],
    [-TENT_WIDTH / 2, TENT_DEPTH / 2],
  ];

  return (
    <group>
      {corners.map(([x, z], index) => (
        <mesh key={index} position={[x, TENT_HEIGHT / 2, z]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, TENT_HEIGHT, 16]} />
          {poleMaterial}
        </mesh>
      ))}
      {corners.map(([x, z], index) => (
        <mesh key={`clip-${index}`} position={[x, TENT_HEIGHT - 0.005, z]}>
          <boxGeometry args={[0.026, 0.026, 0.026]} />
          <meshStandardMaterial color="#1c1f1d" roughness={0.6} metalness={0.2} />
        </mesh>
      ))}
      {corners.map(([x, z], index) => {
        const [nx, nz] = corners[(index + 1) % corners.length];
        const midX = (x + nx) / 2;
        const midZ = (z + nz) / 2;
        const length = Math.hypot(nx - x, nz - z);
        const angle = Math.atan2(nz - z, nx - x);
        return (
          <mesh
            key={`rail-${index}`}
            position={[midX, TENT_HEIGHT, midZ]}
            rotation={[0, -angle, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.01, 0.01, length, 16]} />
            {poleMaterial}
          </mesh>
        );
      })}
      <mesh position={[TENT_WIDTH / 2 - 0.002, TENT_HEIGHT / 2, TENT_DEPTH / 2 - 0.002]}>
        <boxGeometry args={[0.006, TENT_HEIGHT * 0.92, 0.006]} />
        <meshStandardMaterial color="#14171a" roughness={0.55} metalness={0.35} />
      </mesh>
    </group>
  );
}

function MeshVentPatch({ ventTexture }: { ventTexture: THREE.Texture | null }) {
  return (
    <mesh position={[-TENT_WIDTH * 0.15, 0.14, TENT_DEPTH / 2 - 0.001]}>
      <planeGeometry args={[0.16, 0.11]} />
      <meshStandardMaterial
        color="#14171a"
        alphaMap={ventTexture ?? undefined}
        transparent
        roughness={0.9}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function TentShell({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <mesh position={[0, TENT_HEIGHT / 2, 0]}>
      <boxGeometry args={[TENT_WIDTH, TENT_HEIGHT, TENT_DEPTH]} />
      <meshPhysicalMaterial
        color="#f2f6f3"
        transparent
        opacity={0.1}
        roughness={0.05}
        metalness={0}
        clearcoat={0.6}
        clearcoatRoughness={0.05}
        envMapIntensity={0.6}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function Floor({ floorTexture }: { floorTexture: THREE.Texture | null }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.002, 0]}
      receiveShadow
    >
      <planeGeometry args={[TENT_WIDTH * 0.96, TENT_DEPTH * 0.96]} />
      <meshStandardMaterial
        color="#d8dbd6"
        metalness={0.55}
        roughness={0.42}
        roughnessMap={floorTexture}
        bumpMap={floorTexture}
        bumpScale={0.003}
      />
    </mesh>
  );
}

function GrowLight({
  on,
  metalTexture,
}: {
  on: boolean;
  metalTexture: THREE.Texture | null;
}) {
  const stripCount = 5;
  return (
    <group position={[0, TENT_HEIGHT - 0.14, 0]}>
      <mesh position={[TENT_WIDTH * 0.28, 0.09, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.09, 8]} />
        <meshStandardMaterial color="#2a2f2c" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[-TENT_WIDTH * 0.28, 0.09, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.09, 8]} />
        <meshStandardMaterial color="#2a2f2c" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={[TENT_WIDTH * 0.72, 0.022, TENT_DEPTH * 0.55]} />
        <meshStandardMaterial
          color="#101314"
          metalness={0.55}
          roughness={0.4}
          roughnessMap={metalTexture}
        />
      </mesh>
      {Array.from({ length: stripCount }).map((_, index) => {
        const offset = lerp(
          -TENT_WIDTH * 0.32,
          TENT_WIDTH * 0.32,
          index / (stripCount - 1),
        );
        return (
          <mesh key={index} position={[offset, -0.013, 0]}>
            <boxGeometry args={[0.032, 0.006, TENT_DEPTH * 0.48]} />
            <meshStandardMaterial
              color={on ? "#fff8ec" : "#3a3f3c"}
              emissive={on ? new THREE.Color("#fff1d6") : new THREE.Color("#000000")}
              emissiveIntensity={on ? 1.3 : 0}
            />
          </mesh>
        );
      })}
      {on ? (
        <pointLight
          position={[0, -0.1, 0]}
          intensity={1.4}
          distance={1.5}
          color="#fff2da"
        />
      ) : null}
    </group>
  );
}

function FanBlades({
  spinning,
  radius = 0.05,
}: {
  spinning: boolean;
  radius?: number;
}) {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spinning && blades.current) {
      blades.current.rotation.z += delta * 18;
    }
  });
  const bladeCount = 4;
  return (
    <group ref={blades}>
      <mesh>
        <cylinderGeometry args={[radius * 0.22, radius * 0.22, 0.016, 16]} />
        <meshStandardMaterial color="#d7dbd6" metalness={0.5} roughness={0.3} />
      </mesh>
      {Array.from({ length: bladeCount }).map((_, index) => (
        <group key={index} rotation={[0, 0, (index / bladeCount) * Math.PI * 2]}>
          <mesh position={[radius * 0.58, 0, 0]} rotation={[0.55, 0, 0]}>
            <boxGeometry args={[radius * 0.92, radius * 0.4, 0.006]} />
            <meshStandardMaterial
              color="#eceeec"
              metalness={0.25}
              roughness={0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ExhaustAssembly({
  visible,
  spinning,
  metalTexture,
}: {
  visible: boolean;
  spinning: boolean;
  metalTexture: THREE.Texture | null;
}) {
  if (!visible) return null;
  const horizontalLength = EXHAUST_Z - DUCT_EXIT_Z;
  const horizontalCenterZ = (EXHAUST_Z + DUCT_EXIT_Z) / 2;

  return (
    <group position={[EXHAUST_X, 0, 0]}>
      {[0.022, -0.022].map((offset) => (
        <mesh key={offset} position={[offset, TENT_HEIGHT - 0.02, EXHAUST_Z]}>
          <cylinderGeometry args={[0.003, 0.003, 0.04, 6]} />
          <meshStandardMaterial color="#2a2f2c" roughness={0.6} />
        </mesh>
      ))}
      <mesh
        position={[0, FILTER_TOP - FILTER_HEIGHT / 2, EXHAUST_Z]}
        castShadow
      >
        <cylinderGeometry args={[0.06, 0.06, FILTER_HEIGHT, 20]} />
        <meshStandardMaterial
          color="#3a4038"
          metalness={0.45}
          roughness={0.7}
          roughnessMap={metalTexture}
        />
      </mesh>
      <mesh position={[0, FILTER_TOP + 0.006, EXHAUST_Z]}>
        <cylinderGeometry args={[0.062, 0.062, 0.012, 20]} />
        <meshStandardMaterial color="#1c211e" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, FILTER_BOTTOM - 0.045, EXHAUST_Z]}>
        <cylinderGeometry args={[0.045, 0.045, 0.09, 16]} />
        <meshStandardMaterial color="#22262a" metalness={0.55} roughness={0.5} />
      </mesh>

      {/* elbow: vertical filter output bends into the horizontal fan/duct run */}
      <mesh position={[0, FAN_Y, EXHAUST_Z]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#22262a" metalness={0.55} roughness={0.5} />
      </mesh>

      <mesh position={[0, FAN_Y, EXHAUST_Z - 0.09]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.07, 20]} />
        <meshStandardMaterial color="#22262a" metalness={0.6} roughness={0.4} />
      </mesh>
      <group position={[0, FAN_Y, EXHAUST_Z - 0.09]}>
        <FanBlades spinning={spinning} radius={0.045} />
      </group>

      <mesh
        position={[0, FAN_Y, horizontalCenterZ]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.05, 0.05, horizontalLength, 20]} />
        <meshStandardMaterial
          color="#aeb4b0"
          metalness={0.55}
          roughness={0.55}
          roughnessMap={metalTexture}
        />
      </mesh>

      {/* wall port / grommet where the duct passes through the tent wall */}
      <mesh position={[0, FAN_Y, WALL_Z]}>
        <torusGeometry args={[0.065, 0.01, 12, 28]} />
        <meshStandardMaterial color="#14171a" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

function CirculationFan({
  spinning,
  metalTexture,
}: {
  spinning: boolean;
  metalTexture: THREE.Texture | null;
}) {
  const position: [number, number, number] = [
    -TENT_WIDTH / 2 + 0.05,
    TENT_HEIGHT * 0.42,
    0,
  ];
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[0.02, 0.02, 0.1]} />
        <meshStandardMaterial color="#1c1f1d" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <cylinderGeometry args={[0.06, 0.06, 0.05, 20]} />
        <meshStandardMaterial
          color="#2a2f2c"
          metalness={0.4}
          roughness={0.55}
          roughnessMap={metalTexture}
        />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <torusGeometry args={[0.062, 0.006, 8, 24]} />
        <meshStandardMaterial color="#8b9490" metalness={0.5} roughness={0.4} />
      </mesh>
      <group position={[0, 0, 0.035]} rotation={[0, 0, 0]}>
        <FanBlades spinning={spinning} />
      </group>
    </group>
  );
}

function IntakeVent() {
  return (
    <mesh
      position={[-TENT_WIDTH * 0.42, 0.09, TENT_DEPTH * 0.3]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <circleGeometry args={[0.055, 20]} />
      <meshStandardMaterial
        color="#3a3f3c"
        metalness={0.5}
        roughness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

const STREAM_SAMPLES = 22;
const STREAM_SPAN = 0.09;

function WindStream({
  curve,
  phase,
  speed,
  laneOffset,
}: {
  curve: THREE.CatmullRomCurve3;
  phase: number;
  speed: number;
  laneOffset: number;
}) {
  const lineRef = useRef<import("three-stdlib").Line2>(null);
  const initialPoints = useMemo<Array<[number, number, number]>>(
    () => Array.from({ length: STREAM_SAMPLES }, () => [0, 0, 0]),
    [],
  );

  useFrame(({ clock }) => {
    const line = lineRef.current;
    if (!line) return;
    const headT = (clock.elapsedTime * speed + phase) % 1;
    const positions: number[] = [];
    for (let i = 0; i < STREAM_SAMPLES; i += 1) {
      const t = Math.max(0, headT - (i / (STREAM_SAMPLES - 1)) * STREAM_SPAN);
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      positions.push(
        point.x + normal.x * laneOffset,
        point.y,
        point.z + normal.z * laneOffset,
      );
    }
    line.geometry.setPositions(positions);
    const fade = Math.sin(Math.PI * headT);
    const material = line.material as import("three-stdlib").LineMaterial;
    material.opacity = 0.35 + fade * 0.6;
  });

  return (
    <Line
      ref={lineRef}
      points={initialPoints}
      color="#5fd6ff"
      lineWidth={3}
      transparent
      opacity={0.7}
      depthWrite={false}
    />
  );
}

function AirflowParticles({ active }: { active: boolean }) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-TENT_WIDTH * 0.42, 0.09, TENT_DEPTH * 0.3),
        new THREE.Vector3(-TENT_WIDTH * 0.32, 0.55, TENT_DEPTH * 0.22),
        new THREE.Vector3(-TENT_WIDTH * 0.08, 1.02, -0.02),
        new THREE.Vector3(TENT_WIDTH * 0.16, TENT_HEIGHT * 0.9, -TENT_DEPTH * 0.12),
        new THREE.Vector3(EXHAUST_X, FILTER_TOP + 0.05, EXHAUST_Z),
        new THREE.Vector3(EXHAUST_X, FAN_Y, EXHAUST_Z),
        new THREE.Vector3(EXHAUST_X, FAN_Y, DUCT_EXIT_Z),
      ]),
    [],
  );

  const lanes = 5;
  const strandsPerLane = 3;
  const count = lanes * strandsPerLane;
  const strands = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        phase: index / count,
        laneOffset: (Math.floor(index / strandsPerLane) / (lanes - 1) - 0.5) * 0.1,
        speed: 0.16 + (index % strandsPerLane) * 0.02,
      })),
    [count],
  );

  if (!active) return null;

  return (
    <group>
      {strands.map((strand, index) => (
        <WindStream
          key={index}
          curve={curve}
          phase={strand.phase}
          speed={strand.speed}
          laneOffset={strand.laneOffset}
        />
      ))}
    </group>
  );
}

function Pot() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.11, 0.18, 24]} />
        <meshPhysicalMaterial
          color="#34362f"
          roughness={0.75}
          clearcoat={0.15}
          clearcoatRoughness={0.6}
        />
      </mesh>
      <mesh position={[0, 0.185, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.02, 24]} />
        <meshStandardMaterial color="#5b3a24" roughness={0.95} />
      </mesh>
    </group>
  );
}

const LEAF_GREENS = ["#3d7a3f", "#498a48", "#589757", "#649f5f"];
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Right-half profile of a single serrated cannabis leaflet, base (petiole) at
// y=0 tapering to a point at y=1. Mirrored to build the full blade outline.
const LEAFLET_PROFILE: Array<[number, number]> = [
  [0.02, 0.0],
  [0.095, 0.08],
  [0.07, 0.14],
  [0.145, 0.21],
  [0.105, 0.27],
  [0.16, 0.35],
  [0.115, 0.43],
  [0.14, 0.52],
  [0.085, 0.62],
  [0.095, 0.7],
  [0.05, 0.83],
  [0.022, 0.92],
];

function createLeafletShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  LEAFLET_PROFILE.forEach(([x, y]) => shape.lineTo(x, y));
  shape.lineTo(0, 1);
  for (let i = LEAFLET_PROFILE.length - 1; i >= 0; i -= 1) {
    const [x, y] = LEAFLET_PROFILE[i];
    shape.lineTo(-x, y);
  }
  shape.closePath();
  return shape;
}

const LEAFLET_GEOMETRY = new THREE.ShapeGeometry(createLeafletShape());

function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function Plant({ growth }: { growth: number }) {
  const stemHeight = lerp(0.16, 0.98, growth);
  const isFlowering = growth > 0.62;
  const budColor = isFlowering
    ? new THREE.Color().lerpColors(
        new THREE.Color("#e7c46a"),
        new THREE.Color("#d17b45"),
        Math.min(1, (growth - 0.62) / 0.38),
      )
    : null;

  const leafClusters = useMemo(() => {
    const random = createSeededRandom(11);
    const nodeCount = 18;
    return Array.from({ length: nodeCount }).map((_, nodeIndex) => {
      const t = nodeIndex / (nodeCount - 1);
      const heightT = 0.1 + t * 0.9 + (random() - 0.5) * 0.02;
      const azimuth = nodeIndex * GOLDEN_ANGLE + (random() - 0.5) * 0.3;
      const count = Math.max(3, Math.round(lerp(8, 2, t)));
      const nodeScale = lerp(1, 0.5, t);
      const leaflets = Array.from({ length: count }).map((_, i) => {
        const lt = count === 1 ? 0.5 : i / (count - 1);
        const centerness = 1 - Math.abs(lt - 0.5) * 2;
        const fanAngle = count === 1 ? 0 : (lt - 0.5) * 2.1;
        return {
          fanAngle,
          leafSize: (0.13 + centerness * 0.08) * nodeScale * (0.85 + random() * 0.2),
          droop: 0.1 + (1 - centerness) * 0.5 + random() * 0.1,
          color: LEAF_GREENS[Math.floor(random() * LEAF_GREENS.length)],
        };
      });
      return {
        heightT,
        azimuth,
        attachRadius: 0.02 + nodeScale * 0.016,
        leaflets,
      };
    });
  }, []);

  const budClusters = useMemo(() => {
    const random = createSeededRandom(97);
    const nodeCount = 18;
    const items: Array<{
      heightT: number;
      azimuth: number;
      radius: number;
      size: number;
    }> = [];
    for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex += 1) {
      const t = nodeIndex / (nodeCount - 1);
      if (t < 0.4) continue;
      const flowerT = (t - 0.4) / 0.6;
      const heightT = 0.1 + t * 0.9;
      const azimuth = nodeIndex * GOLDEN_ANGLE + (random() - 0.5) * 0.3;
      const nodeScale = lerp(1, 0.45, flowerT);
      const nuggetCount = Math.max(2, Math.round(lerp(4, 2, flowerT)));
      for (let i = 0; i < nuggetCount; i += 1) {
        items.push({
          heightT: heightT + (random() - 0.5) * 0.02 + i * 0.01,
          azimuth: azimuth + (random() - 0.5) * 0.7,
          radius: (0.045 + random() * 0.028) * nodeScale,
          size: (0.02 + random() * 0.012) * nodeScale,
        });
      }
    }
    return items;
  }, []);

  const canopyScale = lerp(0.65, 1.35, growth);

  return (
    <group position={[0, 0.195, 0]}>
      <mesh position={[0, stemHeight / 2, 0]}>
        <cylinderGeometry args={[0.003, 0.022, stemHeight, 8]} />
        <meshStandardMaterial color="#4a6b3a" roughness={0.75} />
      </mesh>
      {leafClusters.map((cluster, ci) => (
        <group
          key={ci}
          position={[
            Math.sin(cluster.azimuth) * cluster.attachRadius,
            stemHeight * cluster.heightT,
            Math.cos(cluster.azimuth) * cluster.attachRadius,
          ]}
          rotation={[0, cluster.azimuth, 0]}
        >
          {cluster.leaflets.map((leaf, li) => (
            <group key={li} rotation={[0, leaf.fanAngle, 0]}>
              <mesh
                geometry={LEAFLET_GEOMETRY}
                rotation={[Math.PI / 2 + leaf.droop, 0, 0]}
                scale={[leaf.leafSize * canopyScale, leaf.leafSize * canopyScale, 1]}
                castShadow
              >
                <meshStandardMaterial
                  color={leaf.color}
                  roughness={0.8}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {isFlowering && budColor
        ? budClusters.map((bud, index) => (
            <mesh
              key={index}
              position={[
                Math.sin(bud.azimuth) * bud.radius,
                stemHeight * bud.heightT,
                Math.cos(bud.azimuth) * bud.radius,
              ]}
              scale={[bud.size, bud.size * 1.3, bud.size]}
              castShadow
            >
              <sphereGeometry args={[1, 8, 7]} />
              <meshStandardMaterial color={budColor} roughness={0.6} />
            </mesh>
          ))
        : null}
    </group>
  );
}

function AutoRotateGroup({
  autoRotate,
  children,
}: {
  autoRotate: boolean;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (autoRotate && group.current) {
      group.current.rotation.y += delta * 0.35;
    }
  });
  return <group ref={group}>{children}</group>;
}

const HOTSPOT_COLORS = {
  tent: "#1f5f3f",
  light: "#d17b45",
  exhaustFan: "#2f6690",
  carbonFilter: "#4a5a52",
  circulationFan: "#3a7ea0",
  substrate: "#8f5a2c",
} as const;

function Hotspot({
  id,
  position,
  label,
  product,
  color,
  activeHotspot,
  onToggle,
}: {
  id: string;
  position: [number, number, number];
  label: string;
  product: TentHotspotProduct | null;
  color: string;
  activeHotspot: string | null;
  onToggle: (id: string) => void;
}) {
  const open = activeHotspot === id;
  if (activeHotspot && !open) return null;
  const openUpward = position[1] < TENT_HEIGHT * 0.35;
  return (
    <Html position={position} center zIndexRange={[10, 0]} pointerEvents="auto">
      <div className="relative">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle(id);
          }}
          aria-label={label}
          className="relative grid h-6 w-6 place-items-center rounded-full border-2 border-white text-[11px] font-bold leading-none text-white shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
          style={{ backgroundColor: color }}
        >
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40"
            style={{ backgroundColor: color }}
          />
          <span className="relative">{open ? "−" : "+"}</span>
        </button>
        {open ? (
          <div
            className={`absolute left-1/2 z-10 w-52 -translate-x-1/2 rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-3.5 text-left shadow-[var(--gv-shadow-lg)] ${
              openUpward ? "bottom-8" : "top-8"
            }`}
          >
            <p className="font-[family:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.14em] text-[color:var(--gv-lime)]">
              {label}
            </p>
            {product ? (
              <>
                <p className="mt-1.5 text-sm font-semibold leading-5 text-[color:var(--gv-text)]">
                  {product.title}
                </p>
                {product.manufacturer ? (
                  <p className="mt-0.5 text-xs text-[color:var(--gv-text-muted)]">
                    {product.manufacturer}
                  </p>
                ) : null}
                <p className="mt-2 text-base font-bold text-[color:var(--gv-text)]">
                  {product.priceLabel}
                </p>
                <Link
                  href={product.href}
                  className="mt-2.5 inline-flex items-center justify-center rounded-full bg-[color:var(--gv-lime)] px-3 py-1.5 text-xs font-semibold text-[color:var(--gv-forest)]"
                >
                  Produkt ansehen
                </Link>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-[color:var(--gv-text-muted)]">
                Kein Produkt gefunden.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </Html>
  );
}

function Scene({
  growth,
  showShell,
  lightOn,
  showDuct,
  showAirflow,
  showCirculation,
  autoRotate,
  products,
  activeHotspot,
  onToggleHotspot,
}: {
  growth: number;
  showShell: boolean;
  lightOn: boolean;
  showDuct: boolean;
  showAirflow: boolean;
  showCirculation: boolean;
  autoRotate: boolean;
  products: GrowTentViewerProductProps;
  activeHotspot: string | null;
  onToggleHotspot: (id: string) => void;
}) {
  const airflowActive = showAirflow && showDuct;
  const textures = useProceduralTextures();
  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight
        color="#f4f7f3"
        groundColor="#8a9b8e"
        intensity={0.55}
      />
      <directionalLight
        position={[1.4, 2.2, 1.2]}
        intensity={0.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <Environment resolution={128} frames={1}>
        <Lightformer
          intensity={1.1}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 4, 0]}
          scale={[6, 6, 1]}
        />
        <Lightformer
          intensity={0.45}
          rotation={[0, Math.PI / 2, 0]}
          position={[-4, 1, 0]}
          scale={[4, 3, 1]}
          color="#dfeee6"
        />
        <Lightformer
          intensity={0.45}
          rotation={[0, -Math.PI / 2, 0]}
          position={[4, 1, 0]}
          scale={[4, 3, 1]}
          color="#dfeee6"
        />
      </Environment>

      <AutoRotateGroup autoRotate={autoRotate}>
        <TentFrame metalTexture={textures.metal} />
        <TentShell visible={showShell} />
        <Floor floorTexture={textures.floor} />
        <GrowLight on={lightOn} metalTexture={textures.metal} />
        <ExhaustAssembly
          visible={showDuct}
          spinning={airflowActive}
          metalTexture={textures.metal}
        />
        {showCirculation ? (
          <CirculationFan spinning={showCirculation} metalTexture={textures.metal} />
        ) : null}
        <IntakeVent />
        <MeshVentPatch ventTexture={textures.vent} />
        <AirflowParticles active={airflowActive} />
        <Pot />
        <Plant growth={growth} />

        <Hotspot
          id="tent"
          position={[TENT_WIDTH / 2 + 0.02, TENT_HEIGHT * 0.62, TENT_DEPTH / 2]}
          label="Growzelt"
          product={products.tent}
          color={HOTSPOT_COLORS.tent}
          activeHotspot={activeHotspot}
          onToggle={onToggleHotspot}
        />
        <Hotspot
          id="light"
          position={[0, TENT_HEIGHT - 0.13, TENT_DEPTH * 0.32]}
          label="LED-Beleuchtung"
          product={products.light}
          color={HOTSPOT_COLORS.light}
          activeHotspot={activeHotspot}
          onToggle={onToggleHotspot}
        />
        {showDuct ? (
          <>
            <Hotspot
              id="carbonFilter"
              position={[EXHAUST_X + 0.06, FILTER_TOP - FILTER_HEIGHT / 2, EXHAUST_Z]}
              label="Aktivkohlefilter"
              product={products.carbonFilter}
              color={HOTSPOT_COLORS.carbonFilter}
              activeHotspot={activeHotspot}
              onToggle={onToggleHotspot}
            />
            <Hotspot
              id="exhaustFan"
              position={[EXHAUST_X + 0.07, FAN_Y, EXHAUST_Z - 0.09]}
              label="Rohrventilator"
              product={products.exhaustFan}
              color={HOTSPOT_COLORS.exhaustFan}
              activeHotspot={activeHotspot}
              onToggle={onToggleHotspot}
            />
          </>
        ) : null}
        {showCirculation ? (
          <Hotspot
            id="circulationFan"
            position={[-TENT_WIDTH / 2 + 0.1, TENT_HEIGHT * 0.42, 0]}
            label="Umluftventilator"
            product={products.circulationFan}
            color={HOTSPOT_COLORS.circulationFan}
            activeHotspot={activeHotspot}
            onToggle={onToggleHotspot}
          />
        ) : null}
        <Hotspot
          id="substrate"
          position={[0.16, 0.16, 0.12]}
          label="Dünger"
          product={products.substrate}
          color={HOTSPOT_COLORS.substrate}
          activeHotspot={activeHotspot}
          onToggle={onToggleHotspot}
        />
      </AutoRotateGroup>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.35}
        scale={2.2}
        blur={2.4}
        far={1}
      />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={1.2}
        maxDistance={3.4}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, TENT_HEIGHT * 0.46, 0]}
      />
    </>
  );
}

export default function GrowTentViewer({
  products,
  compact = false,
}: {
  products: GrowTentViewerProductProps;
  compact?: boolean;
}) {
  const [growth, setGrowth] = useState(0);
  const [showShell, setShowShell] = useState(true);
  const [lightOn, setLightOn] = useState(true);
  const [showDuct, setShowDuct] = useState(true);
  const [showAirflow, setShowAirflow] = useState(true);
  const [showCirculation, setShowCirculation] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);

  useEffect(() => {
    const cycleMs = 24000;
    let start: number | null = null;
    let frame: number;
    const tick = (timestamp: number) => {
      if (start === null) start = timestamp;
      const t = ((timestamp - start) % cycleMs) / cycleMs;
      setGrowth((1 - Math.cos(t * Math.PI * 2)) / 2);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const activeStageLabel = useMemo(() => {
    let closest: (typeof GROWTH_STAGES)[number] = GROWTH_STAGES[0];
    for (const stage of GROWTH_STAGES) {
      if (Math.abs(stage.value - growth) < Math.abs(closest.value - growth)) {
        closest = stage;
      }
    }
    return closest.label;
  }, [growth]);

  return (
    <div className={compact ? "" : "grid gap-4 lg:grid-cols-[1fr_300px]"}>
      <div className="gv-tent-canvas relative h-[420px] overflow-hidden rounded-[28px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] sm:h-[520px]">
        <Canvas
          shadows
          camera={{ position: [1.85, 1.3, 2.05], fov: 40 }}
          onPointerDown={() => setAutoRotate(false)}
          onPointerMissed={() => setActiveHotspot(null)}
          dpr={[1, 1.8]}
          gl={{
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.08,
          }}
        >
          <Suspense fallback={null}>
            <Scene
              growth={growth}
              showShell={showShell}
              lightOn={lightOn}
              showDuct={showDuct}
              showAirflow={showAirflow}
              showCirculation={showCirculation}
              autoRotate={autoRotate}
              products={products}
              activeHotspot={activeHotspot}
              onToggleHotspot={(id) =>
                setActiveHotspot((current) => (current === id ? null : id))
              }
            />
          </Suspense>
        </Canvas>
        <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-[color:var(--gv-dark)]/85 px-3 py-1 font-[family:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.16em] text-[color:var(--gv-text-muted)] shadow-[var(--gv-shadow)]">
          Ziehen zum Drehen · Klicken für Preis
        </span>
      </div>

      {compact ? null : (
      <div className="gv-panel flex flex-col gap-5 rounded-[28px] px-5 py-5">
        <div>
          <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
            Wachstumsphase
          </p>
          <p className="mt-1 text-lg font-semibold text-[color:var(--gv-text)]">
            {activeStageLabel}
          </p>
          <div
            role="progressbar"
            aria-label="Wachstumsphase"
            aria-valuenow={Math.round(growth * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[color:var(--gv-border)]"
          >
            <div
              className="h-full rounded-full bg-[color:var(--gv-lime)]"
              style={{ width: `${Math.round(growth * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between font-[family:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.1em] text-[color:var(--gv-text-muted)]">
            {GROWTH_STAGES.map((stage) => (
              <span key={stage.label}>{stage.label}</span>
            ))}
          </div>
        </div>

        <div className="h-px bg-[color:var(--gv-border)]" />

        <div className="flex flex-col gap-3">
          <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
            Ansicht
          </p>
          {[
            { label: "Zelthülle", value: showShell, set: setShowShell },
            { label: "Beleuchtung", value: lightOn, set: setLightOn },
            { label: "Abluftanlage", value: showDuct, set: setShowDuct },
            { label: "Luftstrom", value: showAirflow, set: setShowAirflow },
            { label: "Umluftventilator", value: showCirculation, set: setShowCirculation },
            { label: "Auto-Drehung", value: autoRotate, set: setAutoRotate },
          ].map((toggle) => (
            <label
              key={toggle.label}
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-3.5 py-2.5 text-sm font-medium text-[color:var(--gv-text)]"
            >
              {toggle.label}
              <input
                type="checkbox"
                checked={toggle.value}
                onChange={(event) => toggle.set(event.target.checked)}
                className="h-4 w-4 accent-[color:var(--gv-lime)]"
              />
            </label>
          ))}
        </div>

        <p className="text-xs leading-5 text-[color:var(--gv-text-muted)]">
          Farbige Punkte am Modell zeigen reale Produkte inkl. Preis aus dem
          Smokeify-Sortiment.
        </p>
      </div>
      )}
    </div>
  );
}
