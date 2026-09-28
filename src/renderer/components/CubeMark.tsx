import { useEffect, useRef } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type BufferGeometry,
} from 'three';

// Face inks from scripts/build-logo.py. At the isometric angle the dark
// face sits on the left and the light face on the right.
const RIGHT = 0x3d536b;
const LEFT = 0x1c2838;
const EDGE = 0x6e849c;
const BOTTOM = 0x10161e;
const SIDE_BACK = 0x243246;
const SIDE_FAR = 0x31475f;

const P_D =
  'M165.29 165.29 H517.36 V400 H400 V517.36 H282.65 V634.72 H165.29 Z M282.65 282.65 V400 H400 V282.65 Z';
const DOT_D = 'M517.36 400 H634.72 V634.72 H517.36 Z';

const TURN_SECONDS = 16;

function paintPi(): CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('pidex cube: 2d canvas unavailable');
  }

  ctx.fillStyle = '#2a3b50';
  ctx.fillRect(0, 0, size, size);

  const min = 165.29;
  const span = 634.72 - min;
  const margin = size * 0.055;
  const scale = (size - margin * 2) / span;
  ctx.save();
  ctx.translate(margin, margin);
  ctx.scale(scale, scale);
  ctx.translate(-min, -min);
  ctx.fillStyle = '#ebe7e4';
  ctx.fill(new Path2D(P_D), 'evenodd');
  ctx.fill(new Path2D(DOT_D));
  ctx.restore();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function paintShadow(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('pidex cube: 2d canvas unavailable');
  }

  const ink = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.48);
  ink.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
  ink.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function CubeMark() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      console.error('pidex cube: webgl unavailable', error);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;

    const scene = new Scene();
    const camera = new PerspectiveCamera(28, 1, 0.1, 20);
    camera.position.set(1, 1, 1).multiplyScalar(2.85);
    camera.lookAt(0, 0.02, 0);

    const cube = new Group();
    scene.add(cube);

    const pi = paintPi();
    const shadowMap = paintShadow();
    const geometries: BufferGeometry[] = [];
    const materials: MeshBasicMaterial[] = [];

    const edgeMaterial = new MeshBasicMaterial({ color: EDGE });
    materials.push(edgeMaterial);

    const thickness = 0.03;
    const length = 1 + thickness;
    const bars: Array<[number, number, number, number, number, number]> = [];
    for (const y of [-0.5, 0.5]) {
      for (const z of [-0.5, 0.5]) bars.push([length, thickness, thickness, 0, y, z]);
    }
    for (const x of [-0.5, 0.5]) {
      for (const z of [-0.5, 0.5]) bars.push([thickness, length, thickness, x, 0, z]);
    }
    for (const x of [-0.5, 0.5]) {
      for (const y of [-0.5, 0.5]) bars.push([thickness, thickness, length, x, y, 0]);
    }
    for (const [w, h, d, x, y, z] of bars) {
      const geometry = new BoxGeometry(w, h, d);
      geometries.push(geometry);
      const mesh = new Mesh(geometry, edgeMaterial);
      mesh.position.set(x, y, z);
      cube.add(mesh);
    }

    const faceGeometry = new PlaneGeometry(1 - thickness, 1 - thickness);
    geometries.push(faceGeometry);
    const lift = 0.004;
    const faces: Array<{
      color: number;
      map?: CanvasTexture;
      position: [number, number, number];
      rotation: [number, number, number];
    }> = [
      { color: 0xffffff, map: pi, position: [0, 0.5 + lift, 0], rotation: [-Math.PI / 2, 0, 0] },
      { color: BOTTOM, position: [0, -0.5 - lift, 0], rotation: [Math.PI / 2, 0, 0] },
      { color: RIGHT, position: [0.5 + lift, 0, 0], rotation: [0, Math.PI / 2, 0] },
      { color: SIDE_FAR, position: [-0.5 - lift, 0, 0], rotation: [0, -Math.PI / 2, 0] },
      { color: LEFT, position: [0, 0, 0.5 + lift], rotation: [0, 0, 0] },
      { color: SIDE_BACK, position: [0, 0, -0.5 - lift], rotation: [0, Math.PI, 0] },
    ];

    for (const face of faces) {
      const material = new MeshBasicMaterial({
        color: face.color,
        ...(face.map ? { map: face.map } : {}),
      });
      materials.push(material);
      const mesh = new Mesh(faceGeometry, material);
      mesh.position.set(...face.position);
      mesh.rotation.set(...face.rotation);
      cube.add(mesh);
    }

    const shadowMaterial = new MeshBasicMaterial({
      map: shadowMap,
      transparent: true,
      depthWrite: false,
    });
    materials.push(shadowMaterial);
    const shadowGeometry = new PlaneGeometry(2.6, 2.6);
    geometries.push(shadowGeometry);
    const shadow = new Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.72;
    scene.add(shadow);

    mount.appendChild(renderer.domElement);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let paused = false;
    const onEnter = () => {
      paused = true;
    };
    const onLeave = () => {
      paused = false;
    };
    mount.addEventListener('pointerenter', onEnter);
    mount.addEventListener('pointerleave', onLeave);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!reduce && !paused) {
        cube.rotation.y += (Math.PI * 2 * delta) / TURN_SECONDS;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mount.removeEventListener('pointerenter', onEnter);
      mount.removeEventListener('pointerleave', onLeave);
      pi.dispose();
      shadowMap.dispose();
      for (const material of materials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={mountRef} className="cube-mark" role="img" aria-label="Rotating three-dimensional pidex mark" />
  );
}

export { CubeMark };
