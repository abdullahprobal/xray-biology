"""Build the below-the-neck models from the official BodyParts3D set.

Usage: python -I tools/build_body.py _work/bp3d site/assets

Reads partof_BP3D_4.0_obj_99.zip + partof_element_parts.txt (CC BY-SA 2.1 JP),
merges the parts we need, simplifies them for phones and writes body.bin + body.json.

Torso meshes are stored in a "torso frame":
  x: 0 at the middle of the hips, +-0.5 at the shoulder joints (+ = the person's left)
  y: 0 at the hip joints, 1 at the shoulder joints (up)
  z: depth, + = front of the body, in units of sqrt(width * height)
Limb bones are stored one unit long along x, from the upper joint to the lower joint.
"""
import json
import sys
import zipfile

import numpy as np

src, out = sys.argv[1], sys.argv[2]
ZIP = zipfile.ZipFile(src + "/partof_BP3D_4.0_obj_99.zip")
PREFIX = "partof_BP3D_4.0_obj_99/"

files_of = {}
for line in open(src + "/partof_element_parts.txt", encoding="utf8").read().splitlines()[1:]:
    cid, name, fid = line.split("\t")
    files_of.setdefault(name.lower(), []).append(fid)

_cache = {}


def load(fid):
    if fid in _cache:
        return _cache[fid]
    V, F = [], []
    for ln in ZIP.read(PREFIX + fid + ".obj").decode("utf8", "replace").splitlines():
        if ln.startswith("v "):
            V.append([float(t) for t in ln.split()[1:4]])
        elif ln.startswith("f "):
            idx = [int(t.split("/")[0]) - 1 for t in ln.split()[1:]]
            for k in range(1, len(idx) - 1):
                F.append([idx[0], idx[k], idx[k + 1]])
    _cache[fid] = (np.array(V, dtype=np.float64), np.array(F, dtype=np.int64).reshape(-1, 3))
    return _cache[fid]


def merge(names, skip=()):
    fids = []
    for n in names:
        if n not in files_of:
            sys.exit("no such part: " + n)
        fids += files_of[n]
    fids = [f for f in dict.fromkeys(fids) if f not in skip]
    Vs, Fs, off = [], [], 0
    for f in fids:
        V, F = load(f)
        Vs.append(V); Fs.append(F + off); off += len(V)
    return np.vstack(Vs), np.vstack(Fs)


def simplify(V, F, target):
    """Vertex clustering on a grid; the cell size is searched to land near the target count."""
    lo, hi = 0.05, float(np.ptp(V, axis=0).max())
    best = None
    for _ in range(22):
        cell = (lo + hi) / 2
        q = np.floor((V - V.min(0)) / cell).astype(np.int64)
        _, inv = np.unique(q, axis=0, return_inverse=True)
        inv = inv.ravel()
        n = inv.max() + 1
        if n > target:
            lo = cell
        else:
            hi = cell; best = (inv, n)
    inv, n = best
    newV = np.zeros((n, 3)); cnt = np.zeros(n)
    np.add.at(newV, inv, V); np.add.at(cnt, inv, 1)
    newV /= cnt[:, None]
    f = inv[F]
    f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
    key = np.sort(f, axis=1)
    _, keep = np.unique(key, axis=0, return_index=True)
    return newV, f[np.sort(keep)]


def ends(V):
    """The two ends of a long bone: (upper, lower)."""
    c = V.mean(0)
    axis = np.linalg.svd(V - c, full_matrices=False)[2][0]
    t = (V - c) @ axis
    span = t.max() - t.min()
    a = V[t > t.max() - 0.04 * span].mean(0)
    b = V[t < t.min() + 0.04 * span].mean(0)
    return (a, b) if a[2] > b[2] else (b, a)


# ---- the torso frame, from the joints the tracker also sees
shoulder_l = ends(merge(["left humerus"])[0])[0]
shoulder_r = ends(merge(["right humerus"])[0])[0]
hip_l = ends(merge(["left femur"])[0])[0]
hip_r = ends(merge(["right femur"])[0])[0]
H = (hip_l + hip_r) / 2
S = (shoulder_l + shoulder_r) / 2
sx = 1.0 if shoulder_l[0] > shoulder_r[0] else -1.0
w = abs(shoulder_l[0] - shoulder_r[0]); h = S[2] - H[2]; s = (w * h) ** 0.5
fy = 1.0 if merge(["sternum"])[0][:, 1].mean() > merge(["vertebral column"])[0][:, 1].mean() else -1.0
print("shoulder width %.0f mm, torso height %.0f mm, left=%+.0f x, front=%+.0f y, right-handed=%s" % (w, h, sx, fy, sx * fy < 0))


def torso_vec(v):
    v = np.atleast_2d(v)
    return np.stack([v[:, 0] * sx / w, v[:, 2] / h, v[:, 1] * fy / s], axis=1)


def torso(p):
    return torso_vec(np.atleast_2d(p) - H)


SPINE = set(files_of["vertebral column"])
TORSO = [  # name, layer, parts, target vertices, parts to leave out
    ("ribs", "skeleton", ["rib cage", "sternum"], 12000, SPINE),
    ("spine", "skeleton", ["vertebral column"], 9000, ()),
    ("pelvis", "skeleton", ["bony pelvis"], 5000, SPINE),
    ("girdle", "skeleton", ["right clavicle", "left clavicle", "right scapula", "left scapula"], 3500, ()),
    ("heart", "chest", ["heart"], 5000, ()),
    ("lungs", "chest", ["right lung", "left lung"], 7000, ()),
    ("trachea", "chest", ["trachea"], 1200, ()),
    ("stomach", "digest", ["stomach", "esophagus"], 2500, ()),
    ("liver", "digest", ["liver", "gallbladder"], 3500, ()),
    ("pancreas", "digest", ["pancreas"], 1000, ()),
    ("smallint", "digest", ["small intestine"], 6500, ()),
    ("largeint", "digest", ["large intestine", "rectum"], 5000, ()),
    ("kidneys", "excretory", ["right kidney", "left kidney"], 2000, ()),
    ("bladder", "excretory", ["urinary bladder"], 800, ()),
]
LIMBS = [  # name, parts, upper landmark, lower landmark (MediaPipe pose numbering), target
    ("humerus_l", ["left humerus"], 11, 13, 1400), ("humerus_r", ["right humerus"], 12, 14, 1400),
    ("forearm_l", ["left radius", "left ulna"], 13, 15, 1600), ("forearm_r", ["right radius", "right ulna"], 14, 16, 1600),
    ("femur_l", ["left femur"], 23, 25, 1600), ("femur_r", ["right femur"], 24, 26, 1600),
    ("shin_l", ["left tibia", "left fibula"], 25, 27, 1800), ("shin_r", ["right tibia", "right fibula"], 26, 28, 1800),
    ("foot_l", ["left foot"], 27, 31, 1500), ("foot_r", ["right foot"], 28, 32, 1500),   # ankle -> tip of the toes
]

blob = bytearray()
meshes = []


def pack(name, layer, V, F, extra=None):
    assert len(V) < 65536, name
    mn = V.min(0); size = np.maximum(V.max(0) - mn, 1e-9)
    q = np.round((V - mn) / size * 65535).astype("<u2")
    m = {"name": name, "layer": layer, "nv": int(len(V)), "ni": int(F.size),
         "min": [round(float(x), 5) for x in mn], "size": [round(float(x), 5) for x in size], "offV": len(blob)}
    blob.extend(q.tobytes())
    m["offI"] = len(blob)
    blob.extend(F.astype("<u2").tobytes())
    if extra:
        m.update(extra)
    meshes.append(m)
    print("%-10s %6d verts %7d tris" % (name, len(V), len(F)))


for name, layer, parts, target, skip in TORSO:
    V, F = simplify(*merge(parts, skip), target)
    pack(name, layer, torso(V), F)

for name, parts, ja, jb, target in LIMBS:
    V, F = merge(parts)
    up, low = ends(V)
    if name.startswith("foot"):                                       # a foot runs from the ankle forward to the toes
        z = V[:, 2]; front = V[:, 1] * fy
        up = V[z > z.max() - 0.08 * np.ptp(z)].mean(0)
        low = V[front > front.max() - 0.05 * np.ptp(front)].mean(0)
    a = low - up; L = np.linalg.norm(a); ah = a / L
    side = np.array([sx, 0.0, 0.0]); b = side - (side @ ah) * ah; b /= np.linalg.norm(b)
    c = np.cross(ah, b)
    V, F = simplify(V, F, target)
    local = np.stack([(V - up) @ ah, (V - up) @ b, (V - up) @ c], axis=1) / L
    cols = [torso_vec(a)[0], torso_vec(b * L)[0], torso_vec(c * L)[0], torso(up)[0]]
    rest = [round(float(x), 5) for col in cols for x in col]          # 4 columns of 3: basis + origin, in the torso frame
    pack(name, "skeleton", local, F, {"limb": [ja, jb], "rest": rest})


def centre(parts, skip=()):
    return [round(float(x), 4) for x in torso(merge(parts, skip)[0].mean(0))[0]]


ribsT = torso(merge(["rib cage"], SPINE)[0])
spineT = torso(merge(["vertebral column"])[0])
low_back = spineT[(spineT[:, 1] > 0.12) & (spineT[:, 1] < 0.3)].mean(0)
anchors = {
    "ribs": [[round(float(x), 4) for x in ribsT[ribsT[:, 0].argmax()]], [round(float(x), 4) for x in ribsT[ribsT[:, 0].argmin()]]],
    "sternum": [centre(["sternum"])],
    "spine": [[round(float(x), 4) for x in low_back]],
    "pelvis": [centre(["left hip bone"]), centre(["right hip bone"])],
    "clavicle": [centre(["left clavicle"]), centre(["right clavicle"])],
    "scapula": [centre(["left scapula"]), centre(["right scapula"])],
    "heart": [centre(["heart"])],
    "lungs": [centre(["left lung"]), centre(["right lung"])],
    "trachea": [centre(["trachea"])],
    "esophagus": [centre(["esophagus"])],
    "stomach": [centre(["stomach"])],
    "liver": [centre(["liver"])],
    "pancreas": [centre(["pancreas"])],
    "smallint": [centre(["small intestine"])],
    "largeint": [centre(["large intestine"])],
    "kidneys": [centre(["left kidney"]), centre(["right kidney"])],
    "bladder": [centre(["urinary bladder"])],
}
meta = {"frame": {"w": round(w / 10, 2), "h": round(h / 10, 2), "s": round(s / 10, 2)}, "meshes": meshes, "anchors": anchors}
open(out + "/body.bin", "wb").write(bytes(blob))
json.dump(meta, open(out + "/body.json", "w", encoding="utf-8"), separators=(",", ":"))
print("body.bin %.2f MB, %d meshes" % (len(blob) / 1e6, len(meshes)))
