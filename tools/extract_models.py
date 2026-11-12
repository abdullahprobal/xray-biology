"""Pull the BodyParts3D-derived model data out of an xray-mirror page.

Usage: python -I extract_models.py <upstream index.html> <output folder>

Only the model DATA is taken (CC BY-SA 2.1 Japan, see MODELS-LICENSE.md).
No upstream program code is copied.
"""
import base64
import json
import re
import sys

src, out = sys.argv[1], sys.argv[2]
html = open(src, encoding="utf-8").read()


def block(tag_id):
    m = re.search(r'<script id="%s"[^>]*>(.*?)</script>' % tag_id, html, re.S)
    if not m:
        sys.exit("missing block: " + tag_id)
    return m.group(1).strip()


meta = json.loads(block("meshmeta"))
data = base64.b64decode(block("meshdata"))

# Sanity check: every mesh must lie inside the binary.
for m in meta["meshes"]:
    assert m["offV"] + m["nv"] * 6 <= len(data), m["name"]
    assert m["offI"] + m["ni"] * 2 <= len(data), m["name"]

keep = {
    "meshes": meta["meshes"],          # name, counts, bounds, byte offsets
    "anchors": meta["labels"],         # 3D points for named structures (cm, head space)
    "fit": meta["fit"],                # face-landmark id -> matching point on the model
    "jawPivot": meta["jawPivot"],
    "demoHand": meta["demoHand"],
}
open(out + "/anatomy.bin", "wb").write(data)
json.dump(keep, open(out + "/anatomy.json", "w", encoding="utf-8"), separators=(",", ":"))
print("meshes:", len(meta["meshes"]), "bytes:", len(data), "anchors:", len(meta["labels"]))
