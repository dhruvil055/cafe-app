import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, Sphere, Cylinder, Torus } from '@react-three/drei';
import * as THREE from 'three';

// Coffee cup built from primitives
function CoffeeCup({ position = [0, 0, 0] }) {
  const groupRef = useRef();
  const steamRef1 = useRef();
  const steamRef2 = useRef();
  const steamRef3 = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.15;
    }
    if (steamRef1.current) {
      steamRef1.current.position.y = 0.9 + Math.sin(t * 2) * 0.1;
      steamRef1.current.material.opacity = 0.4 + Math.sin(t * 2) * 0.2;
    }
    if (steamRef2.current) {
      steamRef2.current.position.y = 0.95 + Math.sin(t * 2 + 1) * 0.1;
      steamRef2.current.material.opacity = 0.3 + Math.sin(t * 2 + 1) * 0.2;
    }
    if (steamRef3.current) {
      steamRef3.current.position.y = 1.0 + Math.sin(t * 2 + 2) * 0.1;
      steamRef3.current.material.opacity = 0.2 + Math.sin(t * 2 + 2) * 0.2;
    }
  });

  const cupMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#FAF6F0',
    roughness: 0.1,
    metalness: 0.0,
  }), []);

  const coffeeMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#3d1f0a',
    roughness: 0.3,
    metalness: 0.1,
  }), []);

  const saucerMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#F0E8D8',
    roughness: 0.2,
    metalness: 0.05,
  }), []);

  const steamMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.3,
    roughness: 1,
  }), []);

  return (
    <group ref={groupRef} position={position}>
      {/* Saucer */}
      <mesh position={[0, -0.55, 0]} material={saucerMaterial} receiveShadow>
        <cylinderGeometry args={[0.85, 0.8, 0.08, 32]} />
      </mesh>
      <mesh position={[0, -0.48, 0]} material={saucerMaterial} receiveShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.05, 32]} />
      </mesh>

      {/* Cup body */}
      <mesh position={[0, 0, 0]} material={cupMaterial} castShadow>
        <cylinderGeometry args={[0.38, 0.28, 0.75, 32, 1, true]} />
      </mesh>

      {/* Cup bottom */}
      <mesh position={[0, -0.375, 0]} material={cupMaterial} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.01, 32]} />
      </mesh>

      {/* Coffee surface */}
      <mesh position={[0, 0.2, 0]} material={coffeeMaterial}>
        <cylinderGeometry args={[0.365, 0.365, 0.04, 32]} />
      </mesh>

      {/* Handle */}
      <mesh position={[0.52, 0.05, 0]} rotation={[0, 0, Math.PI / 2]} material={cupMaterial} castShadow>
        <torusGeometry args={[0.18, 0.04, 12, 24, Math.PI]} />
      </mesh>

      {/* Steam wisps */}
      <mesh ref={steamRef1} position={[-0.08, 0.85, 0]} material={steamMaterial}>
        <sphereGeometry args={[0.06, 8, 8]} />
      </mesh>
      <mesh ref={steamRef2} position={[0.05, 0.9, 0]} material={steamMaterial}>
        <sphereGeometry args={[0.05, 8, 8]} />
      </mesh>
      <mesh ref={steamRef3} position={[-0.02, 0.95, 0]} material={steamMaterial}>
        <sphereGeometry args={[0.04, 8, 8]} />
      </mesh>
    </group>
  );
}

// Floating coffee bean
function CoffeeBean({ position, rotation, scale = 1 }) {
  const ref = useRef();
  const speed = useMemo(() => 0.3 + Math.random() * 0.4, []);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.x = t * speed + offset;
      ref.current.rotation.z = t * speed * 0.7 + offset;
    }
  });

  return (
    <Float speed={speed * 2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={ref} position={position} rotation={rotation} scale={scale} castShadow>
        <sphereGeometry args={[0.08, 8, 6]} />
        <meshStandardMaterial color="#3d1f0a" roughness={0.4} metalness={0.1} />
      </mesh>
    </Float>
  );
}

// Particle system
function Particles({ count = 30 }) {
  const positions = useMemo(() => {
    return Array.from({ length: count }, () => [
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 4 - 2,
    ]);
  }, [count]);

  return (
    <>
      {positions.map((pos, i) => (
        <Float key={i} speed={0.5 + Math.random()} floatIntensity={0.3}>
          <mesh position={pos}>
            <sphereGeometry args={[0.015, 4, 4]} />
            <meshStandardMaterial
              color="#d4862a"
              emissive="#d4862a"
              emissiveIntensity={0.5}
              transparent
              opacity={0.6}
            />
          </mesh>
        </Float>
      ))}
    </>
  );
}

export default function CafeHero3D() {
  // Detect low-end device
  const isLowEnd = typeof navigator !== 'undefined' &&
    navigator.hardwareConcurrency <= 4;

  if (isLowEnd) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-8xl animate-float">☕</div>
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 0.5, 3.5], fov: 45 }}
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.6} />
        <pointLight position={[3, 3, 3]} intensity={1.2} color="#ffd4a0" castShadow />
        <pointLight position={[-3, 1, 1]} intensity={0.4} color="#a0d4ff" />
        <spotLight position={[0, 4, 2]} intensity={0.8} angle={0.4} penumbra={0.5} castShadow />

        <Environment preset="sunset" />

        {/* Main coffee cup with floating animation */}
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.4}>
          <CoffeeCup position={[0, -0.2, 0]} />
        </Float>

        {/* Coffee beans */}
        <CoffeeBean position={[-1.8, 0.8, -0.5]} rotation={[0.5, 0.3, 0.2]} scale={1.2} />
        <CoffeeBean position={[1.6, 0.5, -0.8]} rotation={[1.2, 0.8, 0.5]} scale={0.9} />
        <CoffeeBean position={[-1.4, -0.6, -0.3]} rotation={[0.2, 1.1, 0.7]} scale={1.0} />
        <CoffeeBean position={[1.8, -0.4, -0.6]} rotation={[0.8, 0.4, 1.0]} scale={0.8} />
        <CoffeeBean position={[0.6, 1.2, -1]} rotation={[1.5, 0.2, 0.4]} scale={1.1} />
        <CoffeeBean position={[-0.8, -1.0, -0.8]} rotation={[0.3, 0.9, 1.2]} scale={0.7} />

        {/* Ambient particles */}
        <Particles count={25} />
      </Suspense>
    </Canvas>
  );
}
