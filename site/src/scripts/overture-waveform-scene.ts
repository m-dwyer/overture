import * as THREE from "three";

const W = 128;
const H = 64;
const ANIMATION_FRAMES_PER_SECOND = 11;
const HERO_SCALE = 0.88;
const HERO_X_SHIFT = 4;
const HERO_Y_SHIFT = 4;

type WaveformState = {
  bootFrame: number;
  lastTime: number;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  canvas: HTMLCanvasElement;
  group: THREE.Group;
  activeLayer: THREE.Group;
  reducedMotion: boolean;
  isVisible: boolean;
  animationFrame: number | null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const mapRange = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) => outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);

const lerp = (start: number, end: number, amount: number) =>
  start + (end - start) * amount;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

const impactPulse = (frame: number, start: number, duration: number) => {
  const u = clamp(mapRange(frame, start, start + duration, 0, 1), 0, 1);

  if (u <= 0 || u >= 1) {
    return 0;
  }

  return Math.sin(u * Math.PI) * (1 - u * 0.35);
};

const waveformDrift = (frame: number) => {
  const fast = 0.24;
  const slow = 0.12;
  const settleStart = 20;
  const settleEnd = 42;

  if (frame <= settleStart) {
    return frame * fast;
  }

  const settleFrames = settleEnd - settleStart;

  if (frame >= settleEnd) {
    return (
      settleStart * fast +
      settleFrames * ((fast + slow) * 0.5) +
      (frame - settleEnd) * slow
    );
  }

  const u = (frame - settleStart) / settleFrames;
  const easedAverage = fast + ((slow - fast) * (u * u * u - 0.5 * u * u * u * u)) / u;
  return settleStart * fast + (frame - settleStart) * easedAverage;
};

const oledToScene = (x: number, y: number, z = 0) => new THREE.Vector3(x, H - y, z);

const shadeColor = (shade: number, alpha = 1) =>
  new THREE.Color(
    clamp(shade, 0, 255) / 255,
    clamp(shade, 0, 255) / 255,
    clamp(shade, 0, 255) / 255,
  ).multiplyScalar(alpha);

const createLineStrip = (
  points: THREE.Vector3[],
  shade: number,
  weight: number,
  opacity = 1,
) => {
  const vertices: number[] = [];
  const indices: number[] = [];

  points.forEach((point, index) => {
    let normal = new THREE.Vector2(0, 1);

    if (points.length > 1) {
      const prev = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const tangent = new THREE.Vector2(next.x - prev.x, next.y - prev.y).normalize();
      normal = new THREE.Vector2(-tangent.y, tangent.x);
    }

    const half = weight * 0.5;
    vertices.push(point.x + normal.x * half, point.y + normal.y * half, point.z);
    vertices.push(point.x - normal.x * half, point.y - normal.y * half, point.z);

    if (index < points.length - 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: shadeColor(shade),
      opacity,
      transparent: opacity < 1,
      depthTest: false,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = points[0]?.z ?? 0;
  return mesh;
};

const createEllipse = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  shade: number,
  opacity: number,
  z: number,
) => {
  const curve = new THREE.EllipseCurve(cx, H - cy, rx, ry, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(72).map((point) => new THREE.Vector3(point.x, point.y, z));
  const shape = new THREE.Shape(points.map((point) => new THREE.Vector2(point.x, point.y)));
  const geometry = new THREE.ShapeGeometry(shape);

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: shadeColor(shade),
      opacity,
      transparent: opacity < 1,
      depthTest: false,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = z;
  return mesh;
};

const createEllipseStroke = (
  cx: number,
  cy: number,
  radius: number,
  shade: number,
  weight: number,
  z: number,
) => {
  const curve = new THREE.EllipseCurve(cx, H - cy, radius, radius, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(96).map((point) => new THREE.Vector3(point.x, point.y, z));
  return createLineStrip(points, shade, weight, 1);
};

const disposeObject = (object: THREE.Object3D) => {
  const mesh = object as THREE.Mesh;

  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  const material = mesh.material;
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
  } else if (material) {
    material.dispose();
  }
};

const clearLayer = (layer: THREE.Group) => {
  layer.traverse((object) => {
    if (object !== layer) {
      disposeObject(object);
    }
  });
  layer.clear();
};

const drawWaveLayer = (
  group: THREE.Group,
  startX: number,
  endX: number,
  centerX: number,
  ringIn: number,
  lock: number,
  drift: number,
  amp: number,
  shade: number,
  weight: number,
  detail: number,
  z: number,
) => {
  const wrapStart = centerX - lerp(10, 16, ringIn);
  const wrapEnd = centerX + lerp(10, 16, ringIn);
  const points: THREE.Vector3[] = [];

  for (let x = startX; x <= endX; x += 2) {
    const nx = x / W;
    const wrap = clamp(mapRange(x, wrapStart, wrapEnd, 0, 1), 0, 1);
    const o = Math.sin(wrap * Math.PI);
    const y =
      29 +
      Math.sin(nx * Math.PI * 2 * 2.35 + drift) * lerp(5, amp, lock) +
      Math.sin(nx * Math.PI * 2 * 7.1 + drift * 0.34) * detail +
      o * lerp(0, -11, ringIn);

    points.push(oledToScene(x, y, z));
  }

  if (points.length > 1) {
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
    group.add(createLineStrip(curve.getPoints(points.length * 4), shade, weight, 1));
  }
};

const drawWaveform = (
  group: THREE.Group,
  signalIn: number,
  ringIn: number,
  lock: number,
  drift: number,
  pulse: number,
) => {
  const right = Math.floor(lerp(-14, 122, signalIn));
  const settledAmp = 7 + pulse * 1.25;
  const startX = Math.max(8, right - 126);
  const endX = Math.min(120, right);
  const centerX = 64;

  drawWaveLayer(group, startX, endX, centerX, ringIn, lock, drift, settledAmp + 2, 42, 2.25, 1.7, 3);
  drawWaveLayer(group, startX, endX, centerX, ringIn, lock, drift, settledAmp, 232, 1, 1, 4);
};

const drawEncoderFocus = (group: THREE.Group, ringIn: number) => {
  if (ringIn <= 0) {
    return;
  }

  group.add(createEllipse(64, 28, 18.5, 14, 0, 0.38 * ringIn, 5));
  group.add(createEllipse(64, 28, 24, 17, 0, 0.21 * ringIn, 6));
  group.add(createEllipse(64, 28, 29, 19, 0, 0.09 * ringIn, 7));
};

const drawEncoderKnob = (
  group: THREE.Group,
  bootFrame: number,
  ringIn: number,
  lockHit: number,
) => {
  const cx = 64;
  const cy = 28;
  const outer = lerp(5, 14, ringIn);

  group.add(createEllipse(cx, cy, outer + 1, outer + 1, 7 + ringIn * 6, 1, 8));
  group.add(createEllipseStroke(cx, cy, outer, lerp(42, 235 + lockHit * 14, ringIn), 1.15, 9));

  const turn = easeInOutCubic(clamp(mapRange(bootFrame, 12, 30, 0, 1), 0, 1));
  const angle = lerp(-2.35, 0.35, turn) + lockHit * 0.1;
  const x1 = Math.round(cx + Math.cos(angle) * 3);
  const y1 = Math.round(cy + Math.sin(angle) * 3);
  const x2 = Math.round(cx + Math.cos(angle) * (outer - 5));
  const y2 = Math.round(cy + Math.sin(angle) * (outer - 5));

  group.add(
    createLineStrip(
      [oledToScene(x1, y1, 10), oledToScene(x2, y2, 10)],
      lerp(30, 204 + lockHit * 20, ringIn),
      1,
      1,
    ),
  );
};

const renderFrame = (state: WaveformState) => {
  clearLayer(state.activeLayer);

  const intro = Math.min(state.bootFrame, 36);
  const idle = Math.max(0, state.bootFrame - 36);
  const signalIn = easeOutCubic(clamp(mapRange(intro, 2, 15, 0, 1), 0, 1));
  const ringIn = easeOutCubic(clamp(mapRange(intro, 8, 20, 0, 1), 0, 1));
  const lock = easeOutCubic(clamp(mapRange(intro, 17, 32, 0, 1), 0, 1));
  const lockHit = impactPulse(state.bootFrame, 25, 11);
  const pulse = (Math.sin(idle * 0.2) + 1) * 0.5;
  const drift = waveformDrift(state.bootFrame);

  drawWaveform(state.activeLayer, signalIn, ringIn, lock, drift, pulse);
  drawEncoderFocus(state.activeLayer, ringIn);
  drawEncoderKnob(state.activeLayer, state.bootFrame, ringIn, lockHit);

  state.renderer.render(state.scene, state.camera);
};

const resize = (state: WaveformState) => {
  const { width, height } = state.canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  state.renderer.setPixelRatio(pixelRatio);
  state.renderer.setSize(width, height, false);
};

const animate = (state: WaveformState, time: number) => {
  if (!state.isVisible) {
    state.animationFrame = null;
    return;
  }

  if (!state.lastTime) {
    state.lastTime = time;
  }

  const delta = Math.min(time - state.lastTime, 100);
  state.lastTime = time;

  if (!state.reducedMotion) {
    state.bootFrame += (delta / 1000) * ANIMATION_FRAMES_PER_SECOND;
    renderFrame(state);
  }

  state.animationFrame = window.requestAnimationFrame((nextTime) => animate(state, nextTime));
};

const startAnimation = (state: WaveformState) => {
  if (state.animationFrame !== null) {
    return;
  }

  state.lastTime = 0;
  state.animationFrame = window.requestAnimationFrame((time) => animate(state, time));
};

export const initOvertureWaveform = (canvas: HTMLCanvasElement) => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    failIfMajorPerformanceCaveat: true,
    powerPreference: "low-power",
  });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, W, H, 0, -100, 100);
  const group = new THREE.Group();
  const activeLayer = new THREE.Group();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  renderer.setClearColor(0x000000, 0);
  group.scale.set(HERO_SCALE, HERO_SCALE, 1);
  group.position.set(
    W * (1 - HERO_SCALE) * 0.5 + HERO_X_SHIFT,
    H * (1 - HERO_SCALE) * 0.5 + HERO_Y_SHIFT,
    0,
  );
  scene.add(group);
  group.add(activeLayer);

  const state: WaveformState = {
    bootFrame: reducedMotion ? 54 : 0,
    lastTime: 0,
    renderer,
    scene,
    camera,
    canvas,
    group,
    activeLayer,
    reducedMotion,
    isVisible: false,
    animationFrame: null,
  };

  resize(state);
  renderFrame(state);
  canvas.closest(".hero-display")?.classList.add("is-webgl-ready");

  const observer = new ResizeObserver(() => resize(state));
  observer.observe(canvas);

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      state.isVisible = entry.isIntersecting;

      if (state.isVisible) {
        startAnimation(state);
      }
    },
    { threshold: 0.05 },
  );
  visibilityObserver.observe(canvas);
};
