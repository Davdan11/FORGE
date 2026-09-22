"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { at, type Course } from "@/lib/indoor/course";
import { buildTerrain, scatter, hashSeed } from "@/lib/indoor/terrain";

/* ─────────────────────────────────────────────────────────────
   The world.

   Deliberately not photoreal. A hand-made world takes an art
   team and years, and an approximation of one looks cheap next
   to the games people already play. So the road here is
   generated from the course's own geometry — the same numbers
   that drive the physics — and dressed in FORGE's palette:
   near-black ground, a volt-green ribbon, fog swallowing the
   distance. Stylised reads as a decision. Almost-real reads as
   a budget problem.

   Everything is built from the course once, on mount. The only
   work per frame is moving a handful of objects and the camera,
   so a phone can hold sixty frames while also talking to a
   heart-rate strap.
   ───────────────────────────────────────────────────────────── */

/** Where the ground meets the sky. Fog is tinted to this so the road fades
 *  into the horizon instead of into nothing. */
const HORIZON = 0x43536a;
const VOLT = 0x1fc76f;
const BONE = 0xf6f3ec;

/** Half-width of the road, metres. */
const ROAD_W = 3.4;
/** How far you can see before fog takes over. */
const VIEW_M = 420;

export interface Rider {
  id: string;
  /** Metres travelled along the course. */
  distanceM: number;
  label?: string;
  /** True for the person holding the phone. */
  me?: boolean;
  /** Pedal revolutions per minute, used to drive the model's legs. */
  cadence?: number;
}

/* ── the rider model ──────────────────────────────────────────
   Drop a glTF at /models/cyclist.glb and every avatar becomes
   that model, its pedalling animation driven by real cadence. No
   file, and the primitives below are used instead — so the mode
   works from the first day and gets better when art arrives,
   rather than being blocked on it.

   A model is loaded ONCE and cloned per rider. Loading it forty
   times for forty riders would fetch the same megabytes forty
   times and give each one its own copy of the geometry. */
const MODEL_URL = "/models/cyclist.glb";

type Loaded = { scene: THREE.Object3D; clips: THREE.AnimationClip[] } | null;
let modelPromise: Promise<Loaded> | null = null;

function loadRiderModel(): Promise<Loaded> {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    try {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const head = await fetch(MODEL_URL, { method: "HEAD" });
      if (!head.ok) return null;
      const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
      return { scene: gltf.scene, clips: gltf.animations };
    } catch {
      // A missing or malformed model must never take the ride down with it.
      return null;
    }
  })();
  return modelPromise;
}

/**
 * Riders arrive as a ref, not as a prop.
 *
 * Position changes sixty times a second. Pushing that through React state
 * would re-render the page sixty times a second to move one object, and
 * dropping to a rate React can stand makes the avatar visibly step. So the
 * physics writes into a ref, this loop reads it, and React is left to handle
 * the numbers on the dial at a human rate.
 */
export function World({ course, riders, className = "" }: { course: Course; riders: RefObject<Rider[]>; className?: string }) {
  const mount = useRef<HTMLDivElement | null>(null);
  const live = riders;

  useEffect(() => {
    const host = mount.current;
    if (!host) return;

    const scene = new THREE.Scene();
    // A flat black background gives the road nothing to disappear INTO: it
    // just stops, and the world reads as a void with a stripe in it. A sky
    // that lifts toward the horizon, with the fog tinted to match, turns the
    // same geometry into distance.
    scene.background = skyTexture();
    scene.fog = new THREE.Fog(HORIZON, VIEW_M * 0.3, VIEW_M);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.5, VIEW_M * 1.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    // Without tone mapping a renderer clips every bright value to flat white
    // and the whole image reads as a technical drawing. ACES is what film and
    // every modern game grade through, and it is one line.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    // Soft shadows, small map. A phone cannot afford 4096 and cannot show it.
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Capping at 2 keeps a 3x phone from rendering nine times the pixels for
    // a difference nobody can see through fog.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // The canvas is pinned to the host by CSS, and setSize is told NOT to
    // touch that style. Without this the canvas sizes itself from its own
    // pixel attributes, which grows the host, which the ResizeObserver reads
    // as a resize, which grows the canvas again — a runaway that reached a
    // 33-million-pixel drawing buffer before it was caught.
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });
    host.appendChild(renderer.domElement);

    // Sky bounce, warm ground bounce. The pair is what stops shadowed faces
    // going to pure black, which is the tell of a scene lit by one lamp.
    scene.add(new THREE.HemisphereLight(0x9ec0e0, 0x35302a, 1.35));

    const sun = new THREE.DirectionalLight(0xfff2dc, 2.9);
    sun.position.set(-140, 120, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    // The shadow camera is a box that travels with the rider: it only has to
    // cover what is on screen, and a box big enough for a 40 km course would
    // give every shadow the resolution of a thumbnail.
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90;
    sc.near = 1; sc.far = 400;
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    scene.add(sun.target);

    const ground = buildGround(course);
    scene.add(ground);
    scene.add(buildRoad(course));
    scene.add(buildEdges(course));
    scene.add(buildCentreLine(course));
    scene.add(buildMarkers(course));
    scene.add(buildTrees(course));

    const avatars = new Map<string, THREE.Object3D>();
    const mixers = new Map<string, THREE.AnimationMixer>();
    const group = new THREE.Group();
    scene.add(group);

    // Kicked off here rather than awaited: the ride starts immediately with
    // primitives and upgrades itself the moment the model lands.
    let model: Loaded = null;
    let cancelled = false;
    loadRiderModel().then((m) => { if (!cancelled) model = m; });

    let raf = 0;
    const clock = new THREE.Clock();

    function frame() {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.1);

      const present = new Set<string>();
      let me: Rider | undefined;

      for (const r of live.current) {
        present.add(r.id);
        if (r.me) me = r;
        let avatar = avatars.get(r.id);
        if (!avatar) {
          const built = buildAvatar(r.me === true, model);
          avatar = built.object;
          if (built.mixer) mixers.set(r.id, built.mixer);
          avatars.set(r.id, avatar);
          group.add(avatar);
        }
        place(avatar, course, r.distanceM);

        const mixer = mixers.get(r.id);
        if (mixer) {
          // Legs turn at the cadence the sensor reports. A model pedalling at
          // a fixed rate while the numbers say 95 rpm is worse than no legs.
          mixer.timeScale = (r.cadence ?? 80) / 60;
          mixer.update(dt);
        } else {
          // Primitive fallback: a small bob, enough to read as effort.
          avatar.children[0].position.y = 0.9 + Math.sin(clock.elapsedTime * 6 + r.distanceM) * 0.04;
        }
      }

      // Somebody who left the ride should leave the road.
      for (const [id, obj] of avatars) {
        if (!present.has(id)) { group.remove(obj); avatars.delete(id); mixers.delete(id); }
      }

      if (me) {
        follow(camera, course, me.distanceM, dt);
        // Drag the shadow box along with the rider, or shadows simply stop
        // existing a few hundred metres from the start line.
        const here = at(course, me.distanceM);
        sun.target.position.set(here.x, here.alt, here.z);
        sun.position.set(here.x - 140, here.alt + 120, here.z + 80);
      }
      renderer.render(scene, camera);
    }

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      // A host with no size yet, or one that has somehow grown past any real
      // display, is not something to allocate a buffer for.
      if (!w || !h || w > 8000 || h > 8000) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    frame();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      // WebGL resources are not garbage collected with the scene graph; a
      // route change without this leaks a whole world each time.
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else (mat as THREE.Material | undefined)?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // `live` is a ref: its identity never changes, so listing it would only
    // suggest the scene should be rebuilt when the riders change, which is the
    // one thing this design exists to avoid.
  }, [course, live]);

  return <div ref={mount} className={`overflow-hidden ${className}`} aria-label="Virtual course" role="img" />;
}

/* ── geometry, all built once ─────────────────────────────── */

/** The road surface: two triangles per course segment, offset left and right
 *  of the centreline by the road's half-width. */
function buildRoad(course: Course) {
  const pts = course.points;
  const pos: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i < pts.length; i++) {
    const [nx, nz] = normalAt(pts, i);
    const p = pts[i];
    pos.push(p.x + nx * ROAD_W, p.alt, p.z + nz * ROAD_W);
    pos.push(p.x - nx * ROAD_W, p.alt, p.z - nz * ROAD_W);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const road = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }));
  road.receiveShadow = true;
  return road;
}

/** A volt line down each edge. This is what makes the road readable at speed:
 *  the surface alone is nearly the same value as the ground. */
function buildEdges(course: Course) {
  const group = new THREE.Group();
  for (const side of [1, -1]) {
    const v: number[] = [];
    course.points.forEach((p, i) => {
      const [nx, nz] = normalAt(course.points, i);
      v.push(p.x + nx * ROAD_W * side, p.alt + 0.05, p.z + nz * ROAD_W * side);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    group.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: VOLT, transparent: true, opacity: 0.9 })));
  }
  return group;
}

/** A post every kilometre, so progress exists in the world and not only on a
 *  dial. Instanced: a 200 km course would otherwise add 200 draw calls. */
function buildMarkers(course: Course) {
  const count = Math.max(0, Math.floor(course.lengthM / 1000));
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.22, 1.2, 0.22),
    new THREE.MeshStandardMaterial({ color: BONE, roughness: 0.6 }),
    Math.max(count, 1),
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const d = (i + 1) * 1000;
    const p = at(course, d);
    const n = normalAtDistance(course, d);
    m.makeTranslation(p.x + n[0] * (ROAD_W + 1.4), p.alt + 0.6, p.z + n[1] * (ROAD_W + 1.4));
    mesh.setMatrixAt(i, m);
  }
  mesh.count = count;
  mesh.castShadow = true;
  return mesh;
}

/** A vertical gradient painted into a texture: deep ink overhead, a cold
 *  blue at the horizon. Two hundred bytes of canvas doing the work a skybox
 *  would need six images for. */
function skyTexture() {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#0d1420");
  g.addColorStop(0.55, "#1d2b3d");
  g.addColorStop(1, "#43536a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/** Dashes down the middle. Without them the road surface is a single flat
 *  value and speed becomes invisible — you are moving, and nothing passes. */
function buildCentreLine(course: Course) {
  const pos: number[] = [];
  const idx: number[] = [];
  const DASH = 6, GAP = 6, W = 0.14;
  let v = 0;
  for (let d = 0; d < course.lengthM; d += DASH + GAP) {
    const a = at(course, d), b = at(course, Math.min(d + DASH, course.lengthM));
    const [nx, nz] = normalAtDistance(course, d + DASH / 2);
    pos.push(a.x + nx * W, a.alt + 0.03, a.z + nz * W);
    pos.push(a.x - nx * W, a.alt + 0.03, a.z - nz * W);
    pos.push(b.x + nx * W, b.alt + 0.03, b.z + nz * W);
    pos.push(b.x - nx * W, b.alt + 0.03, b.z - nz * W);
    idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    v += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x8b9199, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
}

/**
 * The ground, as a landscape rather than a sheet.
 *
 * Heights come from lib/indoor/terrain.ts, which carves the road into rolling
 * relief: every point takes the altitude of the nearest stretch of road, then
 * rises away from it. A climb therefore has a valley around it. The previous
 * version was a single flat plane, which is why a gradient could be read on
 * the dial and nowhere in the world.
 */
function buildGround(course: Course) {
  const t = buildTerrain(course);
  const geo = new THREE.PlaneGeometry(t.width, t.depth, t.size - 1, t.size - 1);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, t.heights[i]);
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x2f3a2c,
    roughness: 1,
    // Flat shading: every triangle keeps its own normal, so the hillsides read
    // as faceted low-poly rather than as a smooth blob. It is the look, and it
    // is also free.
    flatShading: true,
  }));
  mesh.position.set(t.minX + t.width / 2, 0, t.minZ + t.depth / 2);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Trees, as two instanced meshes.
 *
 * Instancing is what makes a forest affordable: eight hundred trunks and eight
 * hundred crowns are two draw calls, not sixteen hundred. Drawn from simple
 * cones and cylinders for now — the moment real props land in
 * public/models/props this is where they get scattered instead, using the same
 * placements so the world does not rearrange itself.
 */
function buildTrees(course: Course, count = 800) {
  const group = new THREE.Group();
  const places = scatter(course, count, hashSeed(course.id));

  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.24, 2.2, 5),
    new THREE.MeshStandardMaterial({ color: 0x3a2f26, roughness: 1, flatShading: true }),
    count,
  );
  const crown = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.5, 5.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x24402a, roughness: 1, flatShading: true }),
    count,
  );
  trunk.castShadow = true;
  crown.castShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();

  places.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation);
    sv.set(p.scale, p.scale, p.scale);

    v.set(p.x, p.y + 1.1 * p.scale, p.z);
    trunk.setMatrixAt(i, m.compose(v, q, sv));

    v.set(p.x, p.y + (2.2 + 2.6) * p.scale, p.z);
    crown.setMatrixAt(i, m.compose(v, q, sv));
  });

  group.add(trunk, crown);
  return group;
}

function buildAvatar(me: boolean, model: Loaded): { object: THREE.Object3D; mixer?: THREE.AnimationMixer } {
  if (model) {
    // SkeletonUtils.clone, not Object3D.clone: a plain clone shares the
    // skeleton, so every rider on the course pedals in lockstep with the
    // first one.
    const object = cloneSkinned(model.scene);
    if (me) tintVolt(object);
    if (!model.clips.length) return { object };
    const mixer = new THREE.AnimationMixer(object);
    mixer.clipAction(model.clips[0]).play();
    return { object, mixer };
  }
  return { object: buildPrimitiveAvatar(me) };
}

/** Deep clone that gives each copy its own skeleton. */
function cloneSkinned(src: THREE.Object3D): THREE.Object3D {
  const copy = src.clone(true);
  const bones = new Map<string, THREE.Bone>();
  copy.traverse((o) => { if ((o as THREE.Bone).isBone) bones.set(o.name, o as THREE.Bone); });
  copy.traverse((o) => {
    const skinned = o as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    const source = skinned.skeleton;
    skinned.skeleton = new THREE.Skeleton(source.bones.map((b) => bones.get(b.name) ?? b), source.boneInverses);
  });
  return copy;
}

/** Mark the rider who is actually pedalling, so they are findable in a bunch. */
function tintVolt(object: THREE.Object3D) {
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    if (!mat?.isMeshStandardMaterial) return;
    const own = mat.clone();
    own.emissive = new THREE.Color(VOLT);
    own.emissiveIntensity = 0.35;
    mesh.material = own;
  });
}

function buildPrimitiveAvatar(me: boolean) {
  const group = new THREE.Group();
  const body = new THREE.Group();

  const colour = me ? VOLT : 0x6d7b86;
  const rider = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.62, 4, 8),
    new THREE.MeshStandardMaterial({ color: colour, roughness: 0.45, emissive: me ? VOLT : 0x000000, emissiveIntensity: me ? 0.3 : 0 }),
  );
  rider.castShadow = true;
  rider.rotation.x = 0.55;   // leaning over the bars
  body.add(rider);

  const wheelGeo = new THREE.TorusGeometry(0.34, 0.045, 6, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.7 });
  for (const z of [0.52, -0.52]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.y = Math.PI / 2;
    w.position.set(0, -0.55, z);
    body.add(w);
  }

  body.position.y = 0.9;
  group.add(body);
  return group;
}

/* ── placement ────────────────────────────────────────────── */

function place(obj: THREE.Object3D, course: Course, d: number) {
  const p = at(course, d);
  obj.position.set(p.x, p.alt, p.z);
  const ahead = at(course, d + 6);
  obj.lookAt(ahead.x, ahead.alt, ahead.z);
}

/** Chase camera, lerped rather than snapped: a camera that tracks exactly
 *  reads as rigid, one that lags slightly reads as speed. */
function follow(camera: THREE.PerspectiveCamera, course: Course, d: number, dt: number) {
  const behind = at(course, d - 6.5);
  const ahead = at(course, d + 26);
  camera.position.lerp(new THREE.Vector3(behind.x, behind.alt + 2.4, behind.z), Math.min(1, dt * 4));
  camera.lookAt(ahead.x, ahead.alt + 1.0, ahead.z);
}

/* ── helpers ──────────────────────────────────────────────── */

/** Unit vector perpendicular to the road at point `i`, on the ground plane. */
function normalAt(pts: Course["points"], i: number): [number, number] {
  const a = pts[Math.max(0, i - 1)];
  const b = pts[Math.min(pts.length - 1, i + 1)];
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  return [-dz / len, dx / len];
}

function normalAtDistance(course: Course, d: number): [number, number] {
  const a = at(course, d - 5), b = at(course, d + 5);
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  return [-dz / len, dx / len];
}
