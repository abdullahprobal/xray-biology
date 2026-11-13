// X-ray Biology (Board & Beyond). Own code. Uses three.js and MediaPipe Tasks Vision.
// Model data: BodyParts3D (CC BY-SA 2.1 JP), see MODELS-LICENSE.md.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODELS = "https://storage.googleapis.com/mediapipe-models/";
const FACE_MODEL = MODELS + "face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL = MODELS + "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL = MODELS + "pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const SITE_NAME = "biology.bandb.academy";
// AdSense: paste the ad unit id (data-ad-slot) for the quiz result here after approval. Empty = no ad.
const AD_CLIENT = "ca-pub-8098716292767078", QUIZ_AD_SLOT = "";
function quizAdHTML() {
  if (!QUIZ_AD_SLOT) return "";
  if (!document.querySelector("script[src*='adsbygoogle']")) {
    const s = document.createElement("script"); s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + AD_CLIENT; document.head.appendChild(s);
  }
  setTimeout(() => { try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {} }, 0);
  return `<div class="ad quizad"><ins class="adsbygoogle" style="display:block;height:250px" data-ad-client="${AD_CLIENT}" data-ad-slot="${QUIZ_AD_SLOT}"></ins></div>`;
}
const QUIZ_LEN = 8;

const $ = id => document.getElementById(id);
const bnNum = n => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const VER = new URL(import.meta.url).searchParams.get("v") || "";   // build.mjs stamps ?v=<hash> on app.js
const withV = u => (VER ? u + (u.includes("?") ? "&" : "?") + "v=" + VER : u);
const getJSON = u => fetch(withV(u)).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
const getBin = u => fetch(withV(u)).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.arrayBuffer(); });
const store = {                                              // per-phone settings; private windows may refuse storage
  get(k, d) { try { const x = JSON.parse(localStorage.getItem("xrb." + k)); return x === null ? d : x; } catch (e) { return d; } },
  set(k, x) { try { localStorage.setItem("xrb." + k, JSON.stringify(x)); } catch (e) {} },
};
const DEBUG = /(^#|&)debug(&|=|$)/.test(location.hash);
const MAX_NAMES = 8;
const NAME_LABEL = { bn: "বাংলা", en: "English", off: "নাম বন্ধ" };

// One-Euro filter: steady when still, quick when moving (Casiez et al. 2012).
class OneEuro {
  constructor(minCut, beta) { this.minCut = minCut; this.beta = beta; this.x = null; }
  reset() { this.x = null; }
  run(x, t) {
    if (this.x === null) { this.x = x; this.dx = 0; this.t = t; return x; }
    const dt = Math.max(t - this.t, 1e-3); this.t = t;
    const a = c => 1 / (1 + 1 / (2 * Math.PI * c * dt));
    this.dx += a(1) * ((x - this.x) / dt - this.dx);
    this.x += a(this.minCut + this.beta * Math.abs(this.dx)) * (x - this.x);
    return this.x;
  }
}
class PointFilter {
  constructor(minCut, beta) { this.f = [0, 1, 2].map(() => new OneEuro(minCut, beta)); }
  reset() { this.f.forEach(f => f.reset()); }
  apply(p, now) { const t = now / 1000; return p.set(this.f[0].run(p.x, t), this.f[1].run(p.y, t), this.f[2].run(p.z, t)); }
}

// ---------------------------------------------------------------- state
// "আমি ↔ হাড়" slider: how dark the shadow over the real person is. Bones always stay at full brightness.
const SEE = see => 0.1 + 0.8 * see;
const LENS_SOFT = 0.55;                                      // the lens is fully clear up to this share of its radius, then fades out
const SHADOW = "#04070d", FEATHER = 0.15;
// Two camera looks. Full body (default): dark shadow over the person, bright bones everywhere.
// Lens: the person stays clearly visible and the anatomy shows only inside a round window that follows the fingertip.
const seeKey = () => (st.lens ? "seeLens" : "seeFull"), seeSaved = () => store.get(seeKey(), st.lens ? 0.375 : 0.95);
const st = {
  see: 0.95,
  lens: store.get("lens2", false),
  mode: null,                      // "mirror" | "explore"
  subject: "head",                 // "head" (face + hands) | "body" (everything below the neck)
  layers: { skull: true, brain: false, muscles: false, eyes: true, hands: true,
            skeleton: true, chest: true, digest: false, excretory: false },
  solid: false, names: "bn", selected: null, quiz: null, lastLayer: null,
};
Object.assign(st.layers, store.get("layers", {}));
if (NAME_LABEL[store.get("names")]) st.names = store.get("names");
let META, CONTENT, PROMOS = [], PARTS = [], ANCHOR = {};
let renderer, headScene, handScene, bodyScene, cam, ortho, baseProj, headGroup, jawPivot;
let W = 2, H = 2, DPR = 1;
const meshes = {};                 // name -> { mesh, layer }
const hands = [];                  // two rigs: { group, palm, bones[], pts[] }
const FINGER_BONES = [[1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[9,10],[10,11],[11,12],[13,14],[14,15],[15,16],[17,18],[18,19],[19,20]];
const HEAD_CENTRE = new THREE.Vector3(0, 3, -5);
const SKULL_BASE = new THREE.Vector3(0, -1.5, -5.5);         // under the skull, where the neck meets it (head space, cm)

// ---------------------------------------------------------------- promotions
function promoHTML(slot, all) {
  const list = PROMOS.filter(p => p.slot === slot);
  if (!list.length) return "";
  const pick = all ? list : [list[Math.floor(Math.random() * list.length)]];
  return pick.map(p => {
    const url = p.url + (p.url.includes("?") ? "&" : "?") + "utm_source=biology&utm_medium=" + slot;
    return `<a class="promo" href="${esc(url)}" target="_blank" rel="noopener"><b>${esc(p.title)}</b><span>${esc(p.text)}</span><em>${esc(p.label)} →</em></a>`;
  }).join("");
}
getJSON("data/promos.json").then(d => { PROMOS = d.promos || []; $("homePromos").innerHTML = promoHTML("home", true); }).catch(() => {});

// ---------------------------------------------------------------- data + scene
let readyPromise = null;
function ready() { return readyPromise || (readyPromise = build()); }

const VERT = `
varying vec3 vNormal; varying vec3 vView; varying vec3 vLocal; uniform float uFlatView;
void main() {
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalMatrix * normal;
  vView = uFlatView > 0.5 ? vec3(0.0, 0.0, 1.0) : -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
// uMode: 0 = see-through glow, 1 = lit solid, 2 = flat fill
const FRAG = `
uniform vec3 uGlow; uniform vec3 uSolid; uniform float uMode, uGain, uAlpha, uFeather, uFade;
varying vec3 vNormal; varying vec3 vView; varying vec3 vLocal;
void main() {
  vec3 n = normalize(vNormal);
  float facing = abs(dot(n, normalize(vView)));
  float soft = uFeather > 0.001 ? smoothstep(0.0, uFeather, facing) : 1.0;   // surfaces turning away at the outline fade out
  float fade = uFade > 0.5 ? smoothstep(-12.4, -9.2, vLocal.y) : 1.0;         // the neck fades out instead of ending in a hard edge
  if (uMode > 1.5) { gl_FragColor = vec4(uGlow, uAlpha * fade * soft); return; }
  if (uMode > 0.5) {
    if (!gl_FrontFacing) n = -n;
    float lit = max(dot(n, normalize(vec3(0.3, 0.6, 0.75))), 0.0);
    gl_FragColor = vec4(uSolid * (0.3 + 0.75 * lit) + vec3(0.18) * pow(1.0 - facing, 3.0), 1.0);
    return;
  }
  float edge = pow(1.0 - facing, 2.1);
  gl_FragColor = vec4(uGlow, clamp((0.035 + 0.95 * edge) * uGain * fade, 0.0, 1.0) * soft * uAlpha);
}`;

function material(glow, solid, gain, mode) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false,
    blending: mode === 2 ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: { uGlow: { value: new THREE.Color(glow) }, uSolid: { value: new THREE.Color(solid) }, uMode: { value: mode || 0 },
                uGain: { value: gain }, uAlpha: { value: 1 }, uFlatView: { value: 0 }, uFeather: { value: 0 }, uFade: { value: 0 } },
  });
  m.userData.gain = gain; return m;
}

function unpack(list, bin) {
  const out = {};
  for (const m of list) {
    const q = new Uint16Array(bin.slice(m.offV, m.offV + m.nv * 6));
    const pos = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) pos[i] = m.min[i % 3] + (q[i] / 65535) * m.size[i % 3];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint16Array(bin.slice(m.offI, m.offI + m.ni * 2)), 1));
    g.computeVertexNormals();
    out[m.name] = g;
  }
  return out;
}

async function build() {
  const [meta, content, bin] = await Promise.all([
    getJSON("assets/anatomy.json"), getJSON("data/parts.json"),
    getBin("assets/anatomy.bin"),
    document.fonts ? document.fonts.load('600 15px "Anek Bangla"', "অ").catch(() => {}) : null,
  ]);
  META = meta; CONTENT = content; PARTS = content.parts;
  for (const a of META.anchors) ANCHOR[a.t] = a;
  const geo = unpack(META.meshes, bin);

  renderer = new THREE.WebGLRenderer({ canvas: $("gl"), alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0); renderer.autoClear = false;
  headScene = new THREE.Scene(); handScene = new THREE.Scene(); bodyScene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(63, 1, 1, 5000);        // MediaPipe's face pose assumes a 63 degree vertical view
  ortho = new THREE.OrthographicCamera(0, 1, 1, 0, -5000, 5000);
  headGroup = new THREE.Group(); headGroup.matrixAutoUpdate = false; headGroup.visible = false; headScene.add(headGroup);
  jawPivot = new THREE.Group(); jawPivot.position.fromArray(META.jawPivot); headGroup.add(jawPivot);

  const add = (name, g, layer, glow, solid, gain, order, mode, parent) => {
    const mesh = new THREE.Mesh(g, material(glow, solid, gain, mode));
    mesh.renderOrder = order; mesh.frustumCulled = false; (parent || headGroup).add(mesh);
    meshes[name] = { mesh, layer, gain, fixed: mode !== undefined };
    return mesh;
  };
  add("veil", geo.skin, "veil", 0x04070d, 0x04070d, 1, -5, 2).material.uniforms.uFade.value = 1;
  add("outline", geo.skin, "outline", 0x6fb6ff, 0x6fb6ff, 0.55, 0, 0).material.uniforms.uFade.value = 1;
  add("muscles", geo.muscles, "muscles", 0xff7a6b, 0xb5483f, 0.5, 1);
  add("cranium", geo.cranium, "skull", 0xbfe3ff, 0xe8e1cf, 1, 2);
  add("jaw", geo.jaw, "skull", 0xbfe3ff, 0xe8e1cf, 1, 2, undefined, jawPivot).position.fromArray(META.jawPivot).multiplyScalar(-1);
  add("eyes", geo.eyes, "eyes", 0xfff3a8, 0xf3f3ec, 0.9, 3);
  add("cerebrum", geo.cerebrum, "brain", 0xff9fc0, 0xe0a39d, 0.4, 4);
  add("hindbrain", geo.hindbrain, "brain", 0xffc37a, 0xd4ab83, 0.6, 4);

  for (let h = 0; h < 2; h++) {
    const group = new THREE.Group(); group.visible = false; handScene.add(group);
    const piece = g => { const m = new THREE.Mesh(g, material(0xd9f0ff, 0xe8e1cf, 1)); m.material.uniforms.uFlatView.value = 1;
                         m.matrixAutoUpdate = false; m.frustumCulled = false; group.add(m); return m; };
    hands.push({ group, palm: piece(geo.hand_palm), bones: FINGER_BONES.map(([a, b]) => piece(geo["hand_b_" + a + "_" + b])), pts: null });
  }
  buildChips(); applyStyle();
  new ResizeObserver(layout).observe($("stage"));
}

// ---------------------------------------------------------------- body (below the neck), loaded only when asked for
let BODY = null, bodyGroup, limbGroup, bodyPromise = null;
const bodyMeshes = {};             // name -> { mesh, layer, limb: [upper, lower] landmark, rest: Matrix4 }
const BODY_LOOK = {                // glow colour, solid colour, glow strength
  ribs: [0xbfe3ff, 0xe8e1cf, 0.8], spine: [0xbfe3ff, 0xe8e1cf, 0.8], pelvis: [0xbfe3ff, 0xe8e1cf, 0.9], girdle: [0xbfe3ff, 0xe8e1cf, 0.9],
  heart: [0xff5d6c, 0xb8404c, 0.8], lungs: [0xffa8b8, 0xd98f9c, 0.35], trachea: [0x9fd8ff, 0x9fc3d9, 0.8],
  stomach: [0xffc37a, 0xd9a066, 0.7], liver: [0xe08a5a, 0x9c5236, 0.45], pancreas: [0xffe08a, 0xd9bd6a, 0.8],
  smallint: [0xffb59a, 0xd9917a, 0.35], largeint: [0xd99a7a, 0xb07a5e, 0.45], kidneys: [0x9be8c9, 0x8a5a4a, 0.9], bladder: [0xfff3a8, 0xd9cf8a, 0.8],
};
function ensureBody() { return bodyPromise || (bodyPromise = buildBody()); }
async function buildBody() {
  const [meta, bin] = await Promise.all([getJSON("assets/body.json"),
    getBin("assets/body.bin")]);
  const geo = unpack(meta.meshes, bin);
  bodyGroup = new THREE.Group(); limbGroup = new THREE.Group();
  bodyGroup.matrixAutoUpdate = limbGroup.matrixAutoUpdate = false;
  for (const m of meta.meshes) {
    const look = BODY_LOOK[m.name] || [0xbfe3ff, 0xe8e1cf, 1];
    const mesh = new THREE.Mesh(geo[m.name], material(look[0], look[1], look[2]));
    mesh.frustumCulled = false; mesh.renderOrder = m.layer === "skeleton" ? 1 : 2;
    const info = { mesh, layer: m.layer, limb: m.limb || null, rest: null,
                   neck: m.neck ? [new THREE.Vector3().fromArray(m.neck), new THREE.Vector3().fromArray(m.neckTop)] : null };
    if (m.limb || m.neck) {
      const r = m.rest; mesh.matrixAutoUpdate = false;
      info.rest = new THREE.Matrix4().set(r[0], r[3], r[6], r[9], r[1], r[4], r[7], r[10], r[2], r[5], r[8], r[11], 0, 0, 0, 1);
      limbGroup.add(mesh);
    } else bodyGroup.add(mesh);
    bodyMeshes[m.name] = info;
  }
  BODY = meta; applyStyle();
}
function placeBody() {                                      // camera view draws in screen space, model view in 3D space
  if (!BODY) return;
  const flat = st.mode === "mirror";
  (flat ? bodyScene : headScene).add(bodyGroup, limbGroup);
  for (const k in bodyMeshes) bodyMeshes[k].mesh.material.uniforms.uFlatView.value = flat ? 1 : 0;
  body.on = false;
}

const body = { on: false, pts: null, Q: null, ok: null, filt: null, hips: [new THREE.Vector3(), new THREE.Vector3()] };
const bR = new THREE.Vector3(), bU = new THREE.Vector3(), bD = new THREE.Vector3(), bS = new THREE.Vector3(), bH = new THREE.Vector3();
const LIMB_TRUST = 0.6;                                     // below this the tracker is guessing: draw nothing
function poseBody(lms, now) {
  const seen = i => (lms[i].visibility === undefined ? 1 : lms[i].visibility);
  if (seen(11) < 0.5 || seen(12) < 0.5) { body.on = false; return; }
  if (!body.pts) {
    body.pts = lms.map(() => new THREE.Vector3()); body.Q = lms.map(() => new THREE.Vector3());
    body.filt = lms.map(() => new PointFilter(1.2, 0.006));
  }
  if (!body.on) body.filt.forEach(f => f.reset());
  lms.forEach((q, i) => body.filt[i].apply(body.pts[i].set(q.x * W, (1 - q.y) * H, 0), now));
  body.ok = lms.map((q, i) => seen(i) >= LIMB_TRUST && q.x > -0.02 && q.x < 1.02 && q.y > -0.02 && q.y < 1.02);
  const P = body.pts, f = BODY.frame;
  bR.subVectors(P[11], P[12]); bS.addVectors(P[11], P[12]).multiplyScalar(0.5);
  // Use the hips only when they are really in the picture and the trunk they give is roughly upright
  // against the shoulders; otherwise the tracker is guessing, so hang the hips straight under the shoulders.
  bU.set(-bR.y, bR.x, 0).multiplyScalar(f.h / f.w);
  bH.addVectors(P[23], P[24]).multiplyScalar(0.5); e1.subVectors(bS, bH);
  const upright = e1.lengthSq() > 1 && e1.dot(bU) / (e1.length() * bU.length()) > 0.82;   // within about 35 degrees
  if (body.ok[23] && body.ok[24] && upright) { body.hips[0].copy(P[23]); body.hips[1].copy(P[24]); }
  else { body.hips[0].copy(P[11]).sub(bU).addScaledVector(bR, -0.18); body.hips[1].copy(P[12]).sub(bU).addScaledVector(bR, 0.18); }
  bH.addVectors(body.hips[0], body.hips[1]).multiplyScalar(0.5);
  bU.subVectors(bS, bH); bD.set(0, 0, Math.sqrt(bR.length() * bU.length()));
  bodyGroup.matrix.makeBasis(bR, bU, bD).setPosition(bH); bodyGroup.matrixWorldNeedsUpdate = true;
  body.on = true;
}
// Runs every frame: arms, legs and neck, using the hand tracker's wrist when a hand is in view.
function placeLimbs(handWrists) {
  const P = body.pts, Q = body.Q, ok = body.ok.slice();
  P.forEach((p, i) => Q[i].copy(p));
  const reach = bR.length() * 1.5;
  for (const hw of handWrists) {
    const i = hw.distanceTo(P[15]) < hw.distanceTo(P[16]) ? 15 : 16;
    if (hw.distanceTo(P[i]) < reach) { Q[i].copy(hw); ok[i] = true; }
  }
  limbGroup.matrix.identity(); limbGroup.matrixWorldNeedsUpdate = true;
  for (const k in bodyMeshes) {
    const m = bodyMeshes[k];
    if (m.neck) { placeNeck(m); continue; }
    if (!m.limb) continue;
    const [a, b] = m.limb; m.seen = ok[a] && ok[b];
    if (!m.seen) continue;
    e1.subVectors(Q[b], Q[a]); const L = Math.max(e1.length(), 1e-6);
    e2.set(-e1.y, e1.x, 0); e3.set(0, 0, L);
    m.mesh.matrix.makeBasis(e1, e2, e3).setPosition(Q[a]); m.mesh.matrixWorldNeedsUpdate = true;
  }
}
const nA = new THREE.Vector3(), nB = new THREE.Vector3(), nR = new THREE.Vector3(), nU = new THREE.Vector3();
function placeNeck(m) {
  nA.copy(m.neck[0]).applyMatrix4(bodyGroup.matrix).setZ(0);        // base of the neck on screen
  nR.copy(m.neck[1]).applyMatrix4(bodyGroup.matrix).setZ(0);        // where the skull sits at rest
  const rest = Math.max(nR.distanceTo(nA), 1e-6);
  nB.copy(nR);
  if (head.on && st.mode === "mirror") {                            // reach up to the base of the tracked skull
    v.copy(SKULL_BASE).applyMatrix4(headM).applyMatrix4(cam.projectionMatrix);
    v.set((v.x + 1) / 2 * W, (v.y + 1) / 2 * H, 0);
    e1.subVectors(v, nA); nU.subVectors(nR, nA).normalize();
    if (e1.dot(nU) > rest * 0.3 && e1.length() < rest * 3) nB.copy(v);
  }
  e1.subVectors(nB, nA); const L = Math.max(e1.length(), 1e-6);
  e2.set(-e1.y, e1.x, 0).multiplyScalar(rest / L); e3.set(0, 0, rest);  // stretch in length only, keep the width
  m.mesh.matrix.makeBasis(e1, e2, e3).setPosition(nA); m.mesh.matrixWorldNeedsUpdate = true;
  m.seen = true; m.base = nA.clone(); m.end = nB.clone();
}
function orbitBody() {
  const f = BODY.frame;
  bodyGroup.matrix.makeTranslation(0, orbit.lift, -orbit.dist)
    .multiply(tmpM.makeRotationX(orbit.pitch)).multiply(tmpM.makeRotationY(orbit.yaw))
    .multiply(tmpM.makeTranslation(0, 0.25 * f.h, 0)).multiply(tmpM.makeScale(f.w, f.h, f.s));
  bodyGroup.matrixWorldNeedsUpdate = true;
  limbGroup.matrix.copy(bodyGroup.matrix); limbGroup.matrixWorldNeedsUpdate = true;
  for (const k in bodyMeshes) { const m = bodyMeshes[k]; if (m.limb || m.neck) { m.seen = true; m.mesh.matrix.copy(m.rest); m.mesh.matrixWorldNeedsUpdate = true; } }
  body.on = true;
}
function shadeBody(g) {                                     // light shadow behind the trunk and limbs so the glow reads on any clothes
  const P = body.pts, Q = body.Q, x = q => q.x, y = q => H - q.y, wide = bR.length();
  g.lineJoin = g.lineCap = "round"; g.strokeStyle = g.fillStyle = SHADOW;
  g.lineWidth = wide * 0.34; g.beginPath();
  [P[11], P[12], body.hips[1], body.hips[0]].forEach((q, k) => k ? g.lineTo(x(q), y(q)) : g.moveTo(x(q), y(q)));
  g.closePath(); g.fill(); g.stroke();
  g.lineWidth = wide * 0.17; g.beginPath();                 // about the thickness of an arm
  for (const k in bodyMeshes) {
    const m = bodyMeshes[k];
    if (m.limb && m.seen) { g.moveTo(x(Q[m.limb[0]]), y(Q[m.limb[0]])); g.lineTo(x(Q[m.limb[1]]), y(Q[m.limb[1]])); }
  }
  g.stroke();
  const nk = bodyMeshes.neck;                               // the neck, up to the chin
  if (nk && nk.base && st.layers.skeleton) {
    g.lineWidth = wide * 0.2; g.beginPath(); g.moveTo(x(nk.base), y(nk.base));
    g.lineTo(x(nk.base) + (x(nk.end) - x(nk.base)) * 0.55, y(nk.base) + (y(nk.end) - y(nk.base)) * 0.55); g.stroke();
  }
}
function bodyDots() {
  const camera = st.mode === "mirror" ? ortho : cam;
  const centreZ = v2.set(0, 0.5, 0).applyMatrix4(bodyGroup.matrix).z;
  for (const part of PARTS) {
    if (!(part.body || part.limb) || !st.layers[part.layer]) continue;
    let best = null, bestZ = -Infinity;
    const take = () => { if (v.z > bestZ) { bestZ = v.z; best = v.clone(); } };
    if (part.body) for (const q of BODY.anchors[part.body] || []) { v.fromArray(q).applyMatrix4(bodyGroup.matrix); take(); }
    else for (const name of part.limb) { const m = bodyMeshes[name]; if (m && m.seen) { v.set(0.5, 0, 0).applyMatrix4(limbGroup.matrix.clone().multiply(m.mesh.matrix)); take(); } }
    if (!best) continue;
    best.applyMatrix4(camera.projectionMatrix);
    const x0 = (best.x + 1) / 2 * W, x = st.mode === "mirror" ? W - x0 : x0, y = (1 - best.y) / 2 * H;
    if (st.mode === "mirror" && head.on && faceBox && x > faceBox[0] && x < faceBox[2] && y > faceBox[1] && y < faceBox[3]) continue;
    dots.push({ part, x, y, front: st.mode === "mirror" || bestZ >= centreZ - 2 });
  }
}

function allMaterials(fn) {
  for (const k in meshes) fn(meshes[k].mesh.material, meshes[k]);
  for (const k in bodyMeshes) fn(bodyMeshes[k].mesh.material, {});
  for (const r of hands) { fn(r.palm.material, {}); r.bones.forEach(b => fn(b.material, {})); }
}
function applyStyle() {
  allMaterials((m, info) => {
    if (info.fixed) return;
    m.uniforms.uMode.value = st.solid ? 1 : 0;
    m.blending = st.solid ? THREE.NormalBlending : THREE.AdditiveBlending;
    m.transparent = !st.solid; m.depthTest = m.depthWrite = st.solid; m.needsUpdate = true;
  });
  $("tStyle").textContent = st.solid ? "সলিড" : "এক্স-রে"; if (typeof syncSee === "function") syncSee();
  $("tNames").textContent = NAME_LABEL[st.names]; $("tNames").classList.toggle("on", st.names !== "off");
}

// ---------------------------------------------------------------- layout
const video = $("video");
const view = { x: 0, y: 0, w: 2, h: 2 };
function layout() {
  if (!renderer) return;
  const r = $("stage").getBoundingClientRect();
  let w = r.width, h = r.height, left = 0, top = 0;
  if (st.mode === "mirror" && video.videoWidth) {           // cover the stage with the camera picture, keep its shape
    const k = Math.max(r.width / video.videoWidth, r.height / video.videoHeight);
    w = video.videoWidth * k; h = video.videoHeight * k; left = (r.width - w) / 2; top = (r.height - h) / 2;
  }
  W = Math.max(2, Math.round(w)); H = Math.max(2, Math.round(h));
  view.x = -left; view.y = -top; view.w = r.width; view.h = r.height;   // the part of the picture on screen
  const L = $("layer"); L.style.width = W + "px"; L.style.height = H + "px"; L.style.left = left + "px"; L.style.top = top + "px";
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
  cam.aspect = W / H; cam.updateProjectionMatrix(); baseProj = cam.projectionMatrix.clone();
  ortho.right = W; ortho.top = H; ortho.updateProjectionMatrix();
  for (const id of ["hud", "shade"]) { const c = $(id); c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
  $("shade").style.filter = `blur(${Math.max(2, W * 0.006).toFixed(1)}px)`;   // soft edge on the shadows
}

// ---------------------------------------------------------------- head pose
const headM = new THREE.Matrix4(), jawM = new THREE.Matrix4(), tmpM = new THREE.Matrix4(), fix = new THREE.Matrix4();
const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(1, 1, 1);
const tP = new THREE.Vector3(), tQ = new THREE.Quaternion(), tS = new THREE.Vector3(), v = new THREE.Vector3(), v2 = new THREE.Vector3();
const head = { on: false, jaw: 0, s: 1, tx: 0, ty: 0 };

function setJaw(open) {
  head.jaw += (open - head.jaw) * 0.6;
  const a = Math.min(1, Math.max(0, head.jaw)) * 0.35;
  jawPivot.rotation.x = a;
  const p = META.jawPivot;
  jawM.makeTranslation(p[0], p[1], p[2]).multiply(tmpM.makeRotationX(a)).multiply(tmpM.makeTranslation(-p[0], -p[1], -p[2]));
}

function poseFromFace(matrix, lms, jawOpen) {
  tmpM.fromArray(matrix).decompose(tP, tQ, tS);
  if (!head.on) { pos.copy(tP); quat.copy(tQ); scl.copy(tS); head.s = 1; head.tx = head.ty = 0; }
  else { pos.lerp(tP, 0.6); quat.slerp(tQ, 0.55); scl.lerp(tS, 0.5); }
  head.on = true;
  headM.compose(pos, quat, scl);
  // Line the model up with the tracked face points on screen: best scale + shift (least squares).
  const P = [], Q = []; let pmx = 0, pmy = 0, qmx = 0, qmy = 0;
  for (const id in META.fit) {
    const q = lms[id]; if (!q) continue;
    v.fromArray(META.fit[id]).applyMatrix4(headM).applyMatrix4(baseProj);
    P.push(v.x, v.y); Q.push(q.x * 2 - 1, 1 - q.y * 2);
    pmx += v.x; pmy += v.y; qmx += q.x * 2 - 1; qmy += 1 - q.y * 2;
  }
  const n = P.length / 2;
  if (n > 2) {
    pmx /= n; pmy /= n; qmx /= n; qmy /= n;
    let up = 0, down = 0;
    for (let i = 0; i < P.length; i += 2) {
      const ax = P[i] - pmx, ay = P[i + 1] - pmy;
      up += ax * (Q[i] - qmx) + ay * (Q[i + 1] - qmy); down += ax * ax + ay * ay;
    }
    const s = Math.min(1.6, Math.max(0.6, down > 1e-9 ? up / down : 1));
    head.s += (s - head.s) * 0.5;
    head.tx += (qmx - head.s * pmx - head.tx) * 0.7;
    head.ty += (qmy - head.s * pmy - head.ty) * 0.7;
  }
  fix.set(head.s, 0, 0, head.tx, 0, head.s, 0, head.ty, 0, 0, 1, 0, 0, 0, 0, 1);
  cam.projectionMatrix.copy(baseProj).premultiply(fix);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  setJaw(jawOpen);
}

const orbit = { yaw: 0.5, pitch: 0.05, dist: 62, spin: true };
function poseFromOrbit(t) {
  if (orbit.spin) orbit.yaw += 0.004;
  head.on = true;
  const tall = H > W;                                     // on a phone the model sits above the text or the open sheet
  const lift = st.mode === "idle" ? (tall ? orbit.dist * 0.33 : 0) : $("card").hidden && $("result").hidden ? 0 : (tall ? orbit.dist * 0.3 : 0);
  const side = st.mode === "idle" && !tall ? orbit.dist * 0.3 : 0;
  orbit.side = (orbit.side || 0) + (side - (orbit.side || 0)) * 0.15;
  orbit.lift = (orbit.lift || 0) + (lift - (orbit.lift || 0)) * 0.15;
  headM.makeTranslation(orbit.side, orbit.lift, -orbit.dist)
    .multiply(tmpM.makeRotationX(orbit.pitch)).multiply(tmpM.makeRotationY(orbit.yaw))
    .multiply(tmpM.makeTranslation(-HEAD_CENTRE.x, -HEAD_CENTRE.y, -HEAD_CENTRE.z));
  cam.projectionMatrix.copy(baseProj); cam.projectionMatrixInverse.copy(baseProj).invert();
  setJaw(0.25 + 0.25 * Math.sin(t / 900));
  if (st.subject === "body" && BODY) orbitBody();
}

// ---------------------------------------------------------------- hands
const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), e3 = new THREE.Vector3(), across = new THREE.Vector3(), hm = new THREE.Matrix4();
function poseHand(rig, lms, flip, now) {
  if (!rig.pts) { rig.pts = lms.map(() => new THREE.Vector3()); rig.filt = lms.map(() => new PointFilter(1.5, 0.01)); }
  if (!rig.group.visible) rig.filt.forEach(f => f.reset());
  lms.forEach((p, i) => rig.filt[i].apply(rig.pts[i].set(p.x * W, (1 - p.y) * H, -p.z * W), now));
  const P = rig.pts, sign = flip ? 1 : -1;
  // The palm piece is stored in a frame of: wrist -> index knuckle, wrist -> little knuckle, palm normal.
  e1.subVectors(P[5], P[0]); e2.subVectors(P[17], P[0]);
  e3.crossVectors(e1, e2).normalize().multiplyScalar(sign * Math.sqrt(e1.length() * e2.length()));
  rig.palm.matrix.makeBasis(e1, e2, e3).setPosition(P[0]); rig.palm.matrixWorldNeedsUpdate = true;
  // Each finger piece is stored one unit long along x, from one joint to the next.
  across.subVectors(P[17], P[5]).normalize();
  FINGER_BONES.forEach(([a, b], i) => {
    e1.subVectors(P[b], P[a]); const len = Math.max(e1.length(), 1e-6); e1.divideScalar(len);
    e2.copy(across).addScaledVector(e1, -across.dot(e1)); if (e2.lengthSq() < 1e-6) e2.set(1, 0, 0); e2.normalize();
    e3.crossVectors(e1, e2).multiplyScalar(sign);
    const L = len * (b % 4 === 0 ? 0.8 : 1);                // the tracked fingertip sits past the end of the last bone
    hm.makeBasis(e1.multiplyScalar(L), e2.multiplyScalar(L), e3.multiplyScalar(L)).setPosition(P[a]);
    rig.bones[i].matrix.copy(hm); rig.bones[i].matrixWorldNeedsUpdate = true;
  });
  rig.group.visible = true;
}

function shadeHands(g, list) {                              // darken the real hand so its bones read clearly
  g.lineJoin = g.lineCap = "round"; g.strokeStyle = g.fillStyle = SHADOW;
  for (const lms of list) {
    const x = i => lms[i].x * W, y = i => lms[i].y * H;
    const d = Math.hypot(x(5) - x(17), y(5) - y(17)) || 1;
    g.lineWidth = d * 0.36; g.beginPath();
    [0, 1, 2, 5, 9, 13, 17].forEach((i, k) => k ? g.lineTo(x(i), y(i)) : g.moveTo(x(i), y(i)));
    g.closePath();
    for (const f of [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]]) f.forEach((i, k) => k ? g.lineTo(x(i), y(i)) : g.moveTo(x(i), y(i)));
    g.fill(); g.stroke();
  }
}

// ---------------------------------------------------------------- hotspots
let dots = [];                                              // [{ part, x, y, front }]
function toScreen(vec) {                                    // view-space point -> hud pixels
  vec.applyMatrix4(cam.projectionMatrix);
  const x = (vec.x + 1) / 2 * W;
  return { x: st.mode === "mirror" ? W - x : x, y: (1 - vec.y) / 2 * H };
}
function collectDots(handCount) {
  dots = [];
  if (st.mode === "idle") return;
  const mirror = st.mode === "mirror";
  if (BODY && body.on && (mirror || st.subject === "body")) bodyDots();
  if (!mirror && st.subject === "body") return;
  if (head.on) {
    const centreZ = v2.copy(HEAD_CENTRE).applyMatrix4(headM).z;
    for (const part of PARTS) {
      if (!part.anchor || !st.layers[part.layer]) continue;
      const a = ANCHOR[part.anchor]; if (!a) continue;
      let best = null, bestZ = -Infinity;
      for (const p of a.pts) {                              // for left/right pairs use the one nearer the camera
        v.fromArray(p); if (a.jaw) v.applyMatrix4(jawM); v.applyMatrix4(headM);
        if (v.z > bestZ) { bestZ = v.z; best = v.clone(); }
      }
      const s = toScreen(best);
      dots.push({ part, x: s.x, y: s.y, front: bestZ > centreZ });
    }
  }
  if (st.mode === "mirror" && st.layers.hands) for (const rig of hands) {
    const P = rig.pts; if (!P || !rig.group.visible) continue;
    const at = (a, b, k) => ({ x: W - (P[a].x + (P[b].x - P[a].x) * k), y: H - (P[a].y + (P[b].y - P[a].y) * k) });
    const spot = { carpals: at(0, 9, 0.12), metacarpals: at(0, 9, 0.62), phalanges: at(9, 10, 1) };
    for (const part of PARTS) if (part.hand) dots.push({ part, x: spot[part.hand].x, y: spot[part.hand].y, front: true });
  }
}
function nearestDot(x, y, reach) {
  let best = null, bd = reach;
  for (const d of dots) { const k = Math.hypot(d.x - x, d.y - y) - (d.front ? 0 : 6); if (k < bd) { bd = k; best = d; } }
  return best;
}

function drawHud(finger) {
  const g = $("hud").getContext("2d");
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
  const q = st.quiz, showNames = st.names !== "off" && !q;
  const label = d => (st.names === "en" ? d.part.en : d.part.bn);
  g.font = '600 14px "Anek Bangla", sans-serif'; g.textBaseline = "middle"; g.lineCap = g.lineJoin = "round";
  for (const d of dots) {
    d.hot = st.selected === d.part.id ? "#ffb02e" : q && q.flash && q.flash.id === d.part.id ? q.flash.color : null;
    d.named = false;
  }
  // Only the most useful names: the chosen part, then the layer just switched on, then what is near the middle.
  const rank = d => (d.hot ? 0 : 1e7) + (d.part.layer === st.lastLayer ? 0 : 1e6) + Math.hypot(d.x - W / 2, d.y - H / 2);
  dots.filter(d => d.hot || (showNames && d.front)).sort((a, b) => rank(a) - rank(b)).slice(0, MAX_NAMES).forEach(d => { d.named = true; });
  // Names stand in two columns beside the subject, joined to their dots by thin lines, like the markers on a film.
  hudNo++;
  let lo = 1e9, hi = -1e9; for (const d of dots) { if (d.x < lo) lo = d.x; if (d.x > hi) hi = d.x; }
  const mid = (lo + hi) / 2, slack = Math.max(12, (hi - lo) * 0.08), edgeL = view.x + 8, edgeR = view.x + view.w - 8;
  const cols = { "-1": [], "1": [] };
  for (const d of dots) {
    if (!d.named) continue;
    const s = nameAt[d.part.id] || (nameAt[d.part.id] = { side: 1, y: d.y, seen: -9 });
    if (hudNo - s.seen > 3) { s.side = d.x < mid ? -1 : 1; s.y = d.y; }                    // new on screen: start at its dot
    else {                                                                                 // a name keeps its side and glides, so nothing flickers
      if (s.side < 0 && d.x > mid + slack) s.side = 1; else if (s.side > 0 && d.x < mid - slack) s.side = -1;
      s.y += (d.y - s.y) * 0.5;
    }
    s.seen = hudNo; d.dir = s.side; d.ly = s.y; cols[s.side].push(d);
  }
  for (const side of [-1, 1]) {
    const list = cols[side].sort((a, b) => a.ly - b.ly); let prev = -1e9;
    for (const d of list) { d.ly = Math.max(d.ly, prev + 22); prev = d.ly; }
    const over = prev - (view.y + view.h - 14); if (over > 0) for (const d of list) d.ly -= over;
    for (const d of list) {                                 // tx = the end of the name nearest the subject; names never leave the screen
      const tw = g.measureText(label(d)).width;
      d.tx = side < 0 ? Math.max(edgeL + tw, lo - 24) : Math.min(edgeR - tw, hi + 24);
    }
  }
  for (const d of dots) {
    const col = CONTENT.layers[d.part.layer].color, hot = d.hot, a = d.front || hot ? 1 : 0.4;
    g.globalAlpha = a; g.shadowColor = "rgba(0,0,0,.8)"; g.shadowBlur = 4;
    g.beginPath(); g.arc(d.x, d.y, hot ? 9 : 6, 0, 6.3); g.lineWidth = hot ? 2.5 : 1; g.strokeStyle = hot || "rgba(241,236,224,.6)"; g.stroke();
    g.beginPath(); g.arc(d.x, d.y, 2.6, 0, 6.3); g.fillStyle = hot || col; g.fill();
    g.shadowBlur = 0;
    if (d.named) {
      const t = label(d);
      g.globalAlpha = 0.75; g.beginPath(); g.moveTo(d.x + d.dir * (hot ? 10 : 7), d.y); g.lineTo(d.tx - d.dir * 5, d.ly);
      g.lineWidth = 1; g.strokeStyle = hot || col; g.stroke();
      g.globalAlpha = 1; g.textAlign = d.dir < 0 ? "right" : "left";
      // dark plate behind the name so it stays readable over any camera background
      const tw = g.measureText(t).width, px = d.dir < 0 ? d.tx - tw - 5 : d.tx - 5;
      g.fillStyle = "rgba(5,6,7,.78)"; g.beginPath(); g.roundRect ? g.roundRect(px, d.ly - 10, tw + 10, 21, 4) : g.rect(px, d.ly - 10, tw + 10, 21); g.fill();
      g.fillStyle = hot || "#fff"; g.fillText(t, d.tx, d.ly + 1);
    }
  }
  g.globalAlpha = 1; g.textAlign = "left";
  if (lens) { g.beginPath(); g.arc(lens.x, lens.y, lens.r, 0, 6.3); g.strokeStyle = "rgba(127,209,255,.75)"; g.lineWidth = 1.5; g.stroke(); }
  if (finger) {                                             // pointing ring for the quiz
    g.beginPath(); g.arc(finger.x, finger.y, 18, 0, 6.3); g.strokeStyle = "rgba(241,236,224,.5)"; g.lineWidth = 1.5; g.stroke();
    if (finger.hold > 0) { g.beginPath(); g.arc(finger.x, finger.y, 18, -1.57, -1.57 + 6.283 * finger.hold); g.strokeStyle = "#ffb02e"; g.lineWidth = 4; g.stroke(); }
  }
  if (DEBUG) {                                              // #debug: what the trackers see, for testing on a phone
    const lines = debugLines();
    g.font = '12px "JetBrains Mono", monospace'; g.textBaseline = "top";
    const ox = view.x + 8, oy = view.y + 112;
    g.fillStyle = "rgba(5,6,7,.85)"; g.fillRect(ox, oy, Math.min(view.w - 16, 330), lines.length * 16 + 10);
    g.fillStyle = "#ffb02e"; lines.forEach((t, i) => g.fillText(t, ox + 6, oy + 5 + i * 16));
  }
}
function debugLines() {
  const c = i => (lastPose && lastPose[i] ? (lastPose[i].visibility ?? 0).toFixed(2) : " -  ");
  return [`v ${VER || "dev"}  ${fps} fps  ${W}x${H}`,
    `face ${trk.face || "-"}  hand ${trk.hand || "-"}  pose ${trk.pose || bodyState || "-"}`,
    `found: head ${head.on ? "yes" : "no"}  hands ${seenHands.length}  body ${body.on ? "yes" : "no"}`,
    `shoulder ${c(11)} ${c(12)}  elbow ${c(13)} ${c(14)}`,
    `wrist ${c(15)} ${c(16)}  hip ${c(23)} ${c(24)}`,
    "on: " + Object.keys(st.layers).filter(k => st.layers[k]).map(k => k.slice(0, 4)).join(" ")];
}

// ---------------------------------------------------------------- frame loop
let faceTracker = null, handTracker = null, poseTracker = null, makeTracker = null, stream = null, lastVideoTime = -1, lostSince = 0, running = false;
let seenHands = [], seenFlip = [], frameNo = 0, lastPose = null, bodyLost = 0, bodyState = "", lastHandAt = -1e9, faceBox = null;
let fps = 0, fpsN = 0, fpsT = 0;
const trk = {};                                             // which processor each tracker runs on, for #debug
function countFrame(now) { fpsN++; if (now - fpsT > 1000) { fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; } }
let wowDone = false, hudNo = 0;
const nameAt = {};                                          // part id -> { side, y, seen }: where its name stood last frame

// X-ray lens: the anatomy shows only inside a round window. It follows the index fingertip, or a finger on the screen.
let lens = null, lensTouch = null, lensUsed = false, lensMask = "", nose = null;
const lensOn = () => st.lens && st.mode === "mirror" && !st.quiz;
const touching = now => lensTouch && now - lensTouch.t < 4000;
function aimLens(now) {
  if (!lensOn()) { lens = null; return; }
  const r = Math.min(view.w, view.h) * 0.3; let x, y;
  if (seenHands[0]) { x = W - seenHands[0][8].x * W; y = seenHands[0][8].y * H; lensUsed = true; }
  else if (touching(now)) { x = lensTouch.x; y = lensTouch.y; }
  else if (head.on && nose) { x = W - nose.x * W; y = nose.y * H; }
  else if (body.on) { x = W - (body.pts[11].x + body.pts[12].x) / 2; y = H - (body.pts[11].y + body.pts[12].y + body.hips[0].y + body.hips[1].y) / 4; }
  else { x = view.x + view.w / 2; y = view.y + view.h * 0.4; }
  if (lens) { lens.x += (x - lens.x) * 0.5; lens.y += (y - lens.y) * 0.5; lens.r = r; } else lens = { x, y, r };
}
function maskLayers() {                                     // the 3D and shadow layers are mirrored by CSS, so the window is placed in their own unmirrored space
  const m = lens ? `radial-gradient(circle ${lens.r.toFixed(1)}px at ${(W - lens.x).toFixed(1)}px ${lens.y.toFixed(1)}px, #000 ${LENS_SOFT * 100}%, transparent 100%)` : "none";
  if (m === lensMask) return; lensMask = m;
  for (const id of ["gl", "shade"]) { const s = $(id).style; s.maskImage = m; s.webkitMaskImage = m; }
}
function xrayWow() {                                         // one scan sweep, a soft "zap" and a short buzz
  if (st.mode !== "mirror") return;
  const el = document.createElement("div"); el.className = "scan"; $("stage").appendChild(el);
  setTimeout(() => el.remove(), 1400);
  try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(35); } catch (e) {}
  try {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    const ac = xrayWow.ac || (xrayWow.ac = new A()), t = ac.currentTime;
    const o = ac.createOscillator(), v = ac.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
    v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(0.06, t + 0.05); v.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(v).connect(ac.destination); o.start(t); o.stop(t + 0.65);
  } catch (e) {}
}
function hint(t) { if ($("hint").textContent !== t) $("hint").textContent = t; }

function render() {
  const mirror = st.mode === "mirror", showBody = mirror || st.subject === "body", showHead = mirror || st.subject !== "body";
  for (const k in meshes) {
    const m = meshes[k];
    m.mesh.visible = m.layer === "veil" ? st.mode === "mirror" && !st.solid
                   : m.layer === "outline" ? !st.solid : !!st.layers[m.layer];
  }
  const glow = mirror && !st.solid, dark = SEE(st.see), L = st.layers;
  meshes.veil.mesh.material.uniforms.uAlpha.value = dark;
  // glowing light adds up, so with several head layers on each one gets a smaller share
  const share = 1 / (0.4 + 0.6 * Math.max(1, (L.skull ? 1 : 0) + (L.brain ? 1 : 0) + (L.muscles ? 1 : 0)));
  allMaterials((m, info) => {
    m.uniforms.uFeather.value = glow ? FEATHER : 0;
    if (info.layer === "veil") return;
    // in lens mode the picture stays bright, and a full-strength glow would burn out to white and hide the face
    m.uniforms.uGain.value = m.userData.gain * (glow && st.lens ? 0.75 : 1) * (glow && info.layer && info.layer !== "outline" ? share : 1);
  });
  if (BODY) {
    bodyGroup.visible = limbGroup.visible = showBody && body.on;
    for (const k in bodyMeshes) { const m = bodyMeshes[k]; m.mesh.visible = !!st.layers[m.layer] && (!m.limb || m.seen); }
  }
  headGroup.visible = head.on && showHead;
  headGroup.matrix.copy(headM); headGroup.matrixWorldNeedsUpdate = true;
  renderer.clear();
  if (st.mode === "mirror") { renderer.render(bodyScene, ortho); renderer.clearDepth(); }
  renderer.render(headScene, cam);                          // the head is drawn over the body, never under it
  renderer.clearDepth(); renderer.render(handScene, ortho);
}

function tick(now) {
  if (!running) return;
  requestAnimationFrame(tick);
  let finger = null;
  if (st.mode === "mirror") {
    if (video.readyState < 2 || video.currentTime === lastVideoTime || !faceTracker) return;
    lastVideoTime = video.currentTime; frameNo++; countFrame(now);
    const L = st.layers;
    const wantFace = L.skull || L.brain || L.muscles || L.eyes;
    const wantHands = handTracker && (L.hands || st.quiz || st.lens);
    const wantBody = poseTracker && BODY && (L.skeleton || L.chest || L.digest || L.excretory);
    const handRecent = now - lastHandAt < 500;              // a hand in view gets every frame, the body every third
    const runHands = wantHands && (!wantBody || handRecent || frameNo % 3 === 0);
    const runBody = wantBody && (!wantHands || !handRecent || frameNo % 3 === 0);
    try {
      if (wantFace) {
        const fr = faceTracker.detectForVideo(video, now);
        const lms = fr.faceLandmarks && fr.faceLandmarks[0], mat = fr.facialTransformationMatrixes && fr.facialTransformationMatrixes[0];
        if (lms && mat) {
          let jaw = 0; const bs = fr.faceBlendshapes && fr.faceBlendshapes[0];
          if (bs) for (const c of bs.categories) if (c.categoryName === "jawOpen") jaw = c.score;
          poseFromFace(mat.data, lms, jaw); lostSince = 0; nose = lms[1];
          let x0 = 1, y0 = 1, x1 = 0, y1 = 0;                // the face on screen; body names stay out of it
          for (const k of lms) { if (k.x < x0) x0 = k.x; if (k.x > x1) x1 = k.x; if (k.y < y0) y0 = k.y; if (k.y > y1) y1 = k.y; }
          const mx = (x1 - x0) * 0.15, my = (y1 - y0) * 0.15;
          faceBox = [W - (x1 + mx) * W, (y0 - my) * H, W - (x0 - mx) * W, (y1 + my) * H];
        } else { if (!lostSince) lostSince = now; if (now - lostSince > 300) head.on = false; }
      } else head.on = false;
      if (runHands) {
        const hr = handTracker.detectForVideo(video, now);
        seenHands = hr.landmarks || [];
        const names = hr.handedness || hr.handednesses || [];
        seenFlip = seenHands.map((_, i) => !!(names[i] && names[i][0] && names[i][0].categoryName === "Left"));
        if (seenHands.length) lastHandAt = now;
      } else if (!wantHands) seenHands = [];
      if (runBody) {                                        // the body is found on its own; no face needed
        const pr = poseTracker.detectForVideo(video, now);
        lastPose = pr.landmarks && pr.landmarks[0] || null;
        if (lastPose) { poseBody(lastPose, now); if (body.on) bodyLost = 0; }
        if (!lastPose || !body.on) { if (!bodyLost) bodyLost = now; body.on = body.on && now - bodyLost < 400; }
      } else if (!wantBody) { body.on = false; lastPose = null; }
    } catch (err) { hint("ট্র্যাকারে সমস্যা: " + err.message); return; }
    const showHands = L.hands ? seenHands : [];
    const rigFor = [null, null];                            // keep each hand on its own rig so smoothing never mixes them
    showHands.forEach((h, i) => { let r = seenFlip[i] ? 0 : 1; if (rigFor[r]) r = 1 - r; if (!rigFor[r]) rigFor[r] = [h, seenFlip[i]]; });
    hands.forEach((rig, r) => { if (rigFor[r]) poseHand(rig, rigFor[r][0], rigFor[r][1], now); else rig.group.visible = false; });
    if (body.on) placeLimbs(seenHands.map(h => new THREE.Vector3(h[0].x * W, (1 - h[0].y) * H, 0)));
    const sh = $("shade"), g = sh.getContext("2d"); g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
    sh.style.opacity = (SEE(st.see) * 0.85).toFixed(2);     // shadows are painted solid, then shown see-through as one piece
    if (!st.solid) { if (body.on) shadeBody(g); if (showHands.length) shadeHands(g, showHands); }
    hint(bodyState === "loading" && !head.on ? "শরীরের মডেল লোড হচ্ছে…"
       : bodyState === "failed" ? "শরীরের মডেল লোড হয়নি। পেজ রিফ্রেশ করো"
       : head.on || body.on || seenHands.length ? (lensOn() && !lensUsed ? "আঙুল তুলে ধরো। লেন্স আঙুলের সাথে ঘুরবে" : "")
       : "ক্যামেরার সামনে এসো। আলো যেন গায়ে পড়ে");
    if (!wowDone && (head.on || body.on)) { wowDone = true; xrayWow(); }
    if (st.quiz) {
      if (seenHands[0]) finger = { x: W - seenHands[0][8].x * W, y: seenHands[0][8].y * H, hold: 0 };
      else if (lastPose && body.on) {                       // far from the camera: point with either index finger
        const i = (lastPose[19].visibility || 0) > (lastPose[20].visibility || 0) ? 19 : 20;
        if ((lastPose[i].visibility || 0) > 0.6) finger = { x: W - lastPose[i].x * W, y: lastPose[i].y * H, hold: 0 };
      }
    }
  } else {
    poseFromOrbit(now); hands.forEach(r => r.group.visible = false);
  }
  aimLens(now); maskLayers();
  render();
  collectDots(seenHands.length);
  if (lens) dots = dots.filter(d => Math.hypot(d.x - lens.x, d.y - lens.y) < lens.r * 0.9);   // nothing to tap outside the lens
  if (finger) quizPoint(finger, now);
  drawHud(finger);
  if (rec) recFrame(now);
}

// ---------------------------------------------------------------- camera + modes
async function loadTrackers() {
  if (faceTracker) return;
  const vision = await import(MP + "/vision_bundle.mjs");
  const files = await vision.FilesetResolver.forVisionTasks(MP + "/wasm");
  const make = (Kind, model, extra) => async delegate =>
    Kind.createFromOptions(files, Object.assign({ baseOptions: { modelAssetPath: model, delegate }, runningMode: "VIDEO" }, extra));
  makeTracker = make(vision.PoseLandmarker, POSE_MODEL, { numPoses: 1 });
  const face = make(vision.FaceLandmarker, FACE_MODEL, { numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: true });
  const hand = make(vision.HandLandmarker, HAND_MODEL, { numHands: 2 });
  try { faceTracker = await face("GPU"); trk.face = "GPU"; } catch (e) { faceTracker = await face("CPU"); trk.face = "CPU"; }
  try { handTracker = await hand("GPU"); trk.hand = "GPU"; }
  catch (e) { try { handTracker = await hand("CPU"); trk.hand = "CPU"; } catch (e2) { handTracker = null; trk.hand = "failed"; } }
}
async function loadPose() {
  if (poseTracker) return;
  await loadTrackers();
  try { poseTracker = await makeTracker("GPU"); trk.pose = "GPU"; } catch (e) { poseTracker = await makeTracker("CPU"); trk.pose = "CPU"; }
}
async function fakeCamera(url) {                             // test hook: #test=<photo in this site> stands in for the camera
  if (!/^[\w\-/.]+$/.test(url) || url.includes("..")) throw new Error("test photo must be a path inside this site");
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = url; await img.decode();
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0); setInterval(() => g.drawImage(img, 0, 0), 66);
  return c.captureStream(15);
}
function stopCamera() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null; } }

function status(text, bad) { const s = $("status"); s.textContent = text; s.className = "status" + (bad ? " bad" : ""); }

async function enter(mode) {
  const buttons = [$("goMirror"), $("goExplore")]; buttons.forEach(b => b.disabled = true);
  let step = "ক্যামেরা";
  try {
    if (mode === "mirror") {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("এই ব্রাউজারে ক্যামেরা চালু করা যায় না। Chrome ব্যবহার করো।");
      status("ক্যামেরার অনুমতি চাওয়া হচ্ছে…");
      if (!stream) {                                        // never open the camera twice: many phones refuse
        stream = want.get("test") ? await fakeCamera(want.get("test"))
               : await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        video.srcObject = stream; await video.play();
      }
    }
    step = "৩ডি মডেল"; status("৩ডি মডেল লোড হচ্ছে…");
    await ready();
    if (mode === "mirror") {
      step = "ট্র্যাকার"; status("ট্র্যাকার লোড হচ্ছে (প্রথমবার একটু সময় লাগে)…"); hint("লোড হচ্ছে…");
      await loadTrackers();
      if (!poseTracker && bodyState !== "loading") {        // the body models and tracker arrive in the background
        bodyState = "loading";
        Promise.all([ensureBody(), loadPose()]).then(() => { bodyState = ""; placeBody(); })
          .catch(err => { bodyState = "failed"; console.error("body", err); });
      }
    } else { stopCamera(); if (st.subject === "body") await ensureBody(); }
    st.mode = mode; wowDone = false; head.on = false; lastVideoTime = -1; seenHands = []; placeBody();
    orbit.dist = st.subject === "body" ? 175 : 62;
    $("subjectSeg").hidden = mode === "mirror";
    for (const b of $("subjectSeg").children) b.classList.toggle("on", b.dataset.subject === st.subject);
    buildChips();
    $("home").hidden = true; $("ui").hidden = false; document.body.classList.add("viewing"); scrollTo(0, 0); hint("");
    $("stage").classList.add("live"); $("stage").classList.toggle("mirrored", mode === "mirror"); $("stage").classList.toggle("explore", mode === "explore");
    for (const b of $("modeSeg").children) b.classList.toggle("on", b.dataset.mode === mode);
    syncChips(); layout(); status(""); syncSee();
    if (!running) { running = true; requestAnimationFrame(tick); }
  } catch (err) {
    stopCamera();
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    const msg = denied ? "ক্যামেরার অনুমতি পাওয়া যায়নি। অনুমতি দিয়ে আবার চেষ্টা করো, অথবা ক্যামেরা ছাড়া দেখো।"
                       : step + " চালু করা যায়নি: " + (err && err.message ? err.message : err);
    status(msg, true);
    if (!$("ui").hidden) hint(msg);
  } finally { buttons.forEach(b => b.disabled = false); }
}
function goHome() {
  stopCamera(); endQuiz(true); closeCard(); idle();
  $("ui").hidden = true; $("home").hidden = false; document.body.classList.remove("viewing");
}
function idle() {                                           // the turning model behind the home page
  st.mode = "idle"; st.subject = "head"; head.on = false; orbit.spin = true; orbit.dist = 62; orbit.pitch = 0.05;
  $("stage").classList.remove("mirrored"); $("stage").classList.add("explore", "live");
  hands.forEach(r => r.group.visible = false); layout();
  if (!running) { running = true; requestAnimationFrame(tick); }
}

// ---------------------------------------------------------------- controls
const GROUPS = { head: "মাথা", body: "শরীর" };
function buildChips() {
  const groups = st.mode === "mirror" ? ["head", "body"] : [st.subject];
  const rows = groups.map(gr => `<div class="lrow"><span class="lname">${GROUPS[gr]}</span>` +
    Object.entries(CONTENT.layers).filter(([, L]) => (L.subject || "head") === gr).map(([k, L]) =>
      `<button class="chip" data-layer="${k}" aria-pressed="false"><i style="background:${L.color}"></i>${esc(L.short || L.bn)}</button>`).join(""));
  rows[0] += `<button class="chip all" data-all="1">সব</button>`;
  $("layerChips").innerHTML = rows.map(r => r + "</div>").join("");
  for (const b of $("layerChips").querySelectorAll("[data-layer]")) b.onclick = () => {
    const k = b.dataset.layer; st.layers[k] = !st.layers[k];
    if (st.layers[k]) st.lastLayer = k;
    store.set("layers", st.layers); syncChips();
  };
  $("layerChips").querySelector("[data-all]").onclick = () => {
    for (const b of $("layerChips").querySelectorAll("[data-layer]")) if (!b.disabled) st.layers[b.dataset.layer] = true;
    store.set("layers", st.layers); syncChips();
  };
}
function syncChips() {
  for (const b of $("layerChips").querySelectorAll("[data-layer]")) {
    const k = b.dataset.layer;
    b.disabled = k === "hands" && (st.mode !== "mirror" || !handTracker);
    b.classList.toggle("on", !!st.layers[k] && !b.disabled); b.setAttribute("aria-pressed", String(!!st.layers[k]));
  }
}
$("goMirror").onclick = () => enter("mirror");
$("goExplore").onclick = () => enter("explore");
$("back").onclick = goHome;
for (const b of $("subjectSeg").children) b.onclick = () => {
  if (b.dataset.subject === st.subject) return;
  endQuiz(true); closeCard(); st.subject = b.dataset.subject; orbit.spin = true; enter(st.mode);
};
for (const b of $("modeSeg").children) b.onclick = () => { if (b.dataset.mode !== st.mode) { endQuiz(true); enter(b.dataset.mode); } };
$("tNames").onclick = () => { st.names = { bn: "en", en: "off", off: "bn" }[st.names]; store.set("names", st.names); applyStyle(); };
$("tStyle").onclick = () => { st.solid = !st.solid; applyStyle(); };
st.see = seeSaved();
$("tLens").onclick = () => { st.lens = !st.lens; store.set("lens2", st.lens); st.see = seeSaved(); syncSee(); };
function syncSee() { $("tLens").classList.toggle("on", st.lens); $("tLens").setAttribute("aria-pressed", String(st.lens)); $("seeRow").hidden = st.mode !== "mirror"; $("see").value = Math.round(st.see * 100); }
$("see").oninput = e => { st.see = e.target.value / 100; store.set(seeKey(), st.see); };
$("tQuiz").onclick = startQuiz;
$("tShot").onclick = snapshot;
$("tRec").onclick = toggleRec;
$("quizStop").onclick = () => endQuiz(true);
$("cardClose").onclick = closeCard;

// tap a dot; in model mode drag to turn, pinch or wheel to zoom
const touches = new Map(); let moved = 0, pinch = 0;
const hud = $("hud");
const local = e => { const r = hud.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const touchLens = p => { if (lensOn()) { lensTouch = { x: p.x, y: p.y, t: performance.now() }; lensUsed = true; } };   // a finger on the screen moves the lens too
hud.addEventListener("pointerdown", e => { touches.set(e.pointerId, local(e)); moved = 0; pinch = 0; hud.setPointerCapture(e.pointerId); touchLens(local(e)); });
hud.addEventListener("pointermove", e => {
  const a = touches.get(e.pointerId); if (!a) return;
  const p = local(e), dx = p.x - a.x, dy = p.y - a.y; moved += Math.abs(dx) + Math.abs(dy); touches.set(e.pointerId, p); touchLens(p);
  if (st.mode !== "explore") return;
  if (touches.size === 2) {
    const [p1, p2] = [...touches.values()], d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (pinch) orbit.dist = Math.min(320, Math.max(28, orbit.dist * pinch / d)); pinch = d;
  } else if (moved > 6) { orbit.spin = false; orbit.yaw += dx * 0.008; orbit.pitch = Math.min(1.2, Math.max(-1.2, orbit.pitch + dy * 0.008)); }
});
const lift = e => {
  const p = touches.get(e.pointerId); touches.delete(e.pointerId);
  if (!p || moved > 8 || e.type === "pointercancel") return;
  const d = nearestDot(p.x, p.y, 34);
  if (st.quiz) { if (d) quizAnswer(d.part); }
  else if (d) openCard(d.part); else closeCard();
};
hud.addEventListener("pointerup", lift); hud.addEventListener("pointercancel", lift);
hud.addEventListener("wheel", e => { if (st.mode === "explore") { e.preventDefault(); orbit.dist = Math.min(320, Math.max(28, orbit.dist * (1 + Math.sign(e.deltaY) * 0.08))); } }, { passive: false });

// ---------------------------------------------------------------- part card
function openCard(part) {
  st.selected = part.id; orbit.spin = false;
  $("cardBody").innerHTML =
    `<p class="en">${esc(part.en)}</p><h3>${esc(part.bn)}</h3><p>${esc(part.about)}</p>` +
    `<ul>${part.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>` +
    `<p class="word">${esc(part.meaning)}</p>` +
    `<div class="row"><a class="btn primary" href="read/${part.id}.html">বিস্তারিত পড়ো</a></div>` + promoHTML("card");
  $("card").hidden = false; $("bottom").hidden = true;
}
function closeCard() { st.selected = null; $("card").hidden = true; $("bottom").hidden = !!st.quiz; }

// ---------------------------------------------------------------- quiz
function startQuiz() {
  closeCard();
  const isBody = p => p.body || (p.limb && p.limb.some(n => bodyMeshes[n] && bodyMeshes[n].seen));
  const can = st.mode === "mirror" ? p => (p.anchor && head.on) || (body.on && isBody(p)) : p => (st.subject === "body" ? p.body || p.limb : p.anchor);
  let pool0 = PARTS.filter(can); if (!pool0.length) pool0 = PARTS.filter(p => p.anchor);
  const pool = pool0.sort(() => Math.random() - 0.5).slice(0, QUIZ_LEN);
  st.quiz = { pool, i: 0, score: 0, flash: null, lock: false, holdId: null, holdFrom: 0, saved: Object.assign({}, st.layers) };
  $("quizbar").hidden = false; $("bottom").hidden = true; $("result").hidden = true;
  nextQuestion();
}
function nextQuestion() {
  const q = st.quiz; if (!q) return;
  if (q.i >= q.pool.length) return showResult();
  const part = q.pool[q.i];
  for (const k in st.layers) st.layers[k] = k === part.layer;   // only the layer in question, so the dots are fair
  q.flash = null; q.lock = false; q.holdId = null;
  $("quizCount").textContent = `প্রশ্ন ${bnNum(q.i + 1)}/${bnNum(q.pool.length)} · স্কোর ${bnNum(q.score)}`;
  $("quizAsk").textContent = `দেখাও: ${part.bn}`;
}
function quizAnswer(part) {
  const q = st.quiz; if (!q || q.lock) return;
  const want = q.pool[q.i]; q.lock = true;
  if (part.id === want.id) { q.score++; q.flash = { id: want.id, color: "#7fe0a3" }; $("quizAsk").textContent = "সঠিক!"; }
  else { q.flash = { id: want.id, color: "#ffb02e" }; $("quizAsk").textContent = `ওটা ${part.bn}। সঠিক জায়গা হলুদ বিন্দু।`; }
  setTimeout(() => { if (st.quiz === q) { q.i++; nextQuestion(); } }, part.id === want.id ? 900 : 2200);
}
function quizPoint(finger, now) {                           // hold a fingertip on a dot to answer
  const q = st.quiz; if (!q || q.lock) return;
  const d = nearestDot(finger.x, finger.y, 30);
  if (!d) { q.holdId = null; return; }
  if (q.holdId !== d.part.id) { q.holdId = d.part.id; q.holdFrom = now; }
  finger.hold = Math.min(1, (now - q.holdFrom) / 900);
  if (finger.hold >= 1) quizAnswer(d.part);
}
function endQuiz(silent) {
  const q = st.quiz; if (!q) return;
  Object.assign(st.layers, q.saved); st.quiz = null;
  $("quizbar").hidden = true; $("bottom").hidden = false; if (silent) $("result").hidden = true;
  if (CONTENT) syncChips();
}
function showResult() {
  const q = st.quiz, n = q.pool.length, s = q.score;
  const line = s === n ? "দারুণ! সব ঠিক।" : s >= n * 0.6 ? "ভালো হয়েছে। আরেকবার দিলে সব পারবে।" : "আরেকটু দেখে নাও, তারপর আবার চেষ্টা করো।";
  endQuiz(false); st.score = { s, n };
  $("resultBody").innerHTML = `<p class="score">${bnNum(s)}/${bnNum(n)}</p><p>${line}</p>` +
    `<div class="row"><button class="btn primary" id="again">আবার খেলো</button><button class="btn line" id="tell">স্কোরসহ ছবি শেয়ার</button><button class="btn ghost" id="done">বন্ধ</button></div>` +
    (promoHTML(s >= n * 0.6 ? "quiz_high" : "quiz_low") || promoHTML("quiz")) + quizAdHTML();
  $("result").hidden = false; $("bottom").hidden = true;
  $("again").onclick = startQuiz;
  $("done").onclick = () => { $("result").hidden = true; $("bottom").hidden = false; };
  $("tell").onclick = () => { $("result").hidden = true; $("bottom").hidden = false; setTimeout(snapshot, 60); };
}

// ---------------------------------------------------------------- photo
function shotCanvas(wide) {                                 // a canvas the shape of the screen, for a photo or a video
  const r = $("stage").getBoundingClientRect(), k = Math.min(2, Math.max(1, wide / r.width));
  const c = document.createElement("canvas"); c.width = Math.round(r.width * k / 2) * 2; c.height = Math.round(r.height * k / 2) * 2;
  return { c, g: c.getContext("2d"), k };
}
const SHARE_TEXT = () => st.score ? `এক্স-রে বায়োলজি কুইজে আমার স্কোর ${bnNum(st.score.s)}/${bnNum(st.score.n)}। তুমি কত পাবে? https://${SITE_NAME}` : `ক্যামেরায় নিজের হাড় দেখো: https://${SITE_NAME}`;
const canShareFile = file => !!(navigator.canShare && navigator.canShare({ files: [file] }));
function saveFile(file) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
let blurTmp = null, overTmp = null;
function paintShot({ c, g, k }) {                           // everything on screen right now, plus the site name
  const r = $("stage").getBoundingClientRect(), L = $("layer").getBoundingClientRect();
  g.fillStyle = "#050607"; g.fillRect(0, 0, c.width, c.height);
  g.save(); g.scale(k, k); g.translate(L.left - r.left, L.top - r.top);
  if (st.mode === "mirror") {
    g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(video, 0, 0, W, H);
    const sh = $("shade"), t = blurTmp || (blurTmp = document.createElement("canvas"));   // shrink then stretch the shadows: a blur that works on every phone
    t.width = Math.ceil(W / 12); t.height = Math.ceil(H / 12); t.getContext("2d").drawImage(sh, 0, 0, t.width, t.height);
    // shadows and anatomy go on a spare canvas first, so the lens can cut them out together
    const o = overTmp || (overTmp = document.createElement("canvas")), s = Math.min(2, k);
    o.width = Math.round(W * s); o.height = Math.round(H * s);
    const og = o.getContext("2d"); og.setTransform(s, 0, 0, s, 0, 0);
    og.globalAlpha = +sh.style.opacity || 1; og.imageSmoothingQuality = "high"; og.drawImage(t, 0, 0, W, H); og.globalAlpha = 1;
    og.drawImage($("gl"), 0, 0, W, H);
    if (lens) {
      const cx = W - lens.x, grad = og.createRadialGradient(cx, lens.y, 0, cx, lens.y, lens.r);
      grad.addColorStop(0, "#000"); grad.addColorStop(LENS_SOFT, "#000"); grad.addColorStop(1, "rgba(0,0,0,0)");
      og.globalCompositeOperation = "destination-in"; og.fillStyle = grad; og.fillRect(0, 0, W, H); og.globalCompositeOperation = "source-over";
    }
    g.drawImage(o, 0, 0, W, H); g.restore();
  } else g.drawImage($("gl"), 0, 0, W, H);
  g.drawImage(hud, 0, 0, W, H); g.restore();
  if (st.score) {                                             // quiz score badge, top left
    const t1 = "কুইজে আমার স্কোর", t2 = bnNum(st.score.s) + "/" + bnNum(st.score.n);
    const bx = 16 * k, by = 16 * k, bw = 190 * k, bh = 92 * k;
    g.fillStyle = "#ffb02e"; g.beginPath(); g.roundRect ? g.roundRect(bx, by, bw, bh, 6 * k) : g.rect(bx, by, bw, bh); g.fill();
    g.fillStyle = "#1a1205"; g.textBaseline = "top";
    g.font = `700 ${Math.round(15 * k)}px "Anek Bangla", sans-serif`; g.fillText(t1, bx + 14 * k, by + 12 * k);
    g.font = `800 ${Math.round(44 * k)}px "Anek Bangla", sans-serif`; g.fillText(t2, bx + 14 * k, by + 34 * k);
  }
  const pad = 18 * k; g.textBaseline = "alphabetic";
  g.font = `700 ${Math.round(20 * k)}px "Anek Bangla", sans-serif`;
  g.fillStyle = "rgba(3,5,10,.6)"; g.fillRect(0, c.height - 64 * k, c.width, 64 * k);
  g.fillStyle = "#fff"; g.fillText(st.score ? "তুমি কত পাবে? এক্স-রে বায়োলজিতে খেলো" : "এক্স-রে বায়োলজি · Board & Beyond", pad, c.height - 36 * k);
  g.font = `500 ${Math.round(14 * k)}px "JetBrains Mono", monospace`; g.fillStyle = "#ffb02e"; g.fillText(SITE_NAME, pad, c.height - 14 * k);
  g.textBaseline = "alphabetic";
}
async function snapshot() {
  const shot = shotCanvas(1080);
  render();                                                 // draw the 3D layer right now so its pixels can be copied
  paintShot(shot);
  const blob = await new Promise(res => shot.c.toBlob(res, "image/jpeg", 0.9));
  if (!blob) return;
  const file = new File([blob], "xray-biology.jpg", { type: "image/jpeg" });
  if (canShareFile(file)) {
    try { await navigator.share({ files: [file], text: SHARE_TEXT() }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  saveFile(file);
}

// ---------------------------------------------------------------- video clip (no sound, up to 10 seconds)
const REC_MS = 10000;
let rec = null;
function toggleRec() {
  if (rec) { rec.mr.stop(); return; }
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { hint("এই ব্রাউজারে ভিডিও রেকর্ড হয় না। ছবি তোলো।"); return; }
  const shot = shotCanvas(720), parts = [];
  // mp4 first: WhatsApp, Facebook and Instagram all take it
  const type = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find(t => MediaRecorder.isTypeSupported(t));
  let mr;
  try { mr = new MediaRecorder(shot.c.captureStream(30), type ? { mimeType: type, videoBitsPerSecond: 4e6 } : {}); }
  catch (e) { hint("এই ব্রাউজারে ভিডিও রেকর্ড হয় না। ছবি তোলো।"); return; }
  mr.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
  mr.onstop = () => {
    clearTimeout(rec.timer); rec = null; $("tRec").textContent = "ভিডিও"; $("tRec").classList.remove("rec");
    if (parts.length) showClip(new Blob(parts, { type: (mr.mimeType || type || "video/webm").split(";")[0] }));
  };
  rec = { mr, shot, from: performance.now(), timer: setTimeout(() => mr.stop(), REC_MS) };
  closeCard(); $("tRec").classList.add("rec"); paintShot(shot); mr.start();
}
function recFrame(now) {                                    // called after each drawn frame while recording
  paintShot(rec.shot);
  $("tRec").textContent = "■ " + bnNum(Math.max(0, Math.ceil((REC_MS - (now - rec.from)) / 1000)));
}
function showClip(blob) {
  const file = new File([blob], "xray-biology." + (blob.type.includes("mp4") ? "mp4" : "webm"), { type: blob.type });
  const url = URL.createObjectURL(blob), share = canShareFile(file);
  $("resultBody").innerHTML = `<video class="clip" src="${url}" controls playsinline muted loop autoplay></video>` +
    `<div class="row">${share ? `<button class="btn primary" id="clipShare">শেয়ার করো</button>` : ""}` +
    `<button class="btn ${share ? "line" : "primary"}" id="clipSave">সেভ করো</button><button class="btn ghost" id="done">বন্ধ</button></div>`;
  $("result").hidden = false; $("bottom").hidden = true;
  if (share) $("clipShare").onclick = () => navigator.share({ files: [file], text: SHARE_TEXT() }).catch(() => {});
  $("clipSave").onclick = () => saveFile(file);
  $("done").onclick = () => { $("result").hidden = true; $("bottom").hidden = false; $("resultBody").innerHTML = ""; URL.revokeObjectURL(url); };
}

// ---------------------------------------------------------------- links from books and reading pages: #part=<id> or #model
const want = new URLSearchParams(location.hash.slice(1));
if (!(want.has("part") || want.has("model") || want.has("test"))) ready().then(idle).catch(() => {});
else {
  if (want.get("model") === "body") st.subject = "body";
  if (want.has("test")) enter("mirror"); else
  getJSON("data/parts.json").then(c => {
    const part = c.parts.find(p => p.id === want.get("part"));
    if (part && (part.body || part.limb)) st.subject = "body";
    return enter("explore").then(() => { if (part && !part.hand) { st.layers[part.layer] = true; syncChips(); openCard(part); } });
  });
}
