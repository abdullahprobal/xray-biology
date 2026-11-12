// Builds the reading pages and copies content into site/. Run: node tools/build.mjs
// Edit content/parts.json and content/promos.json, never the generated files in site/read or site/data.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://bandb.academy/biology/";
const content = JSON.parse(readFileSync(join(root, "content/parts.json"), "utf8"));
const promos = JSON.parse(readFileSync(join(root, "content/promos.json"), "utf8")).promos;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

mkdirSync(join(root, "site/data"), { recursive: true });
mkdirSync(join(root, "site/read"), { recursive: true });
copyFileSync(join(root, "content/parts.json"), join(root, "site/data/parts.json"));
copyFileSync(join(root, "content/promos.json"), join(root, "site/data/promos.json"));
copyFileSync(join(root, "MODELS-LICENSE.md"), join(root, "site/MODELS-LICENSE.md"));

const promo = (slot, i = 0) => {
  const list = promos.filter(p => p.slot === slot); if (!list.length) return "";
  const p = list[i % list.length];
  const url = p.url + (p.url.includes("?") ? "&" : "?") + "utm_source=biology&utm_medium=" + slot;
  return `<a class="promo" href="${esc(url)}" target="_blank" rel="noopener"><b>${esc(p.title)}</b><span>${esc(p.text)}</span><em>${esc(p.label)} →</em></a>`;
};

// Paste the AdSense code here after the site is approved. It then appears on every reading page.
const AD_SLOT = `<div class="ad"><!-- AdSense slot --></div>`;

const page = ({ title, desc, path, body }) => `<!doctype html>
<html lang="bn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | এক্স-রে বায়োলজি</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${BASE}${path}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anek+Bangla:wdth,wght@75..125,400..800&family=Hind+Siliguri:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../style.css">
</head>
<body class="read">
<main>
<nav><a href="../index.html">← এক্স-রে বায়োলজি</a> / <a href="index.html">সব অংশ</a></nav>
${body}
<p class="fine">এই লেখা শেখার সহায়ক। পরীক্ষার জন্য তোমার পাঠ্যবইয়ের সাথে মিলিয়ে নাও।</p>
<p class="fine">Anatomy models: BodyParts3D, © The Database Center for Life Science, CC Attribution-Share Alike 2.1 Japan.</p>
</main>
</body>
</html>
`;

const urls = ["", "read/index.html"];
content.parts.forEach((p, i) => {
  const L = content.layers[p.layer];
  const mates = content.parts.filter(o => o.layer === p.layer && o.id !== p.id);
  const see = p.anchor
    ? `<a class="btn primary" href="../index.html#part=${p.id}">৩ডি মডেলে দেখো</a>`
    : `<a class="btn primary" href="../index.html">ক্যামেরায় নিজের হাতে দেখো</a>`;
  const body = `<p class="en">${esc(p.en)} · ${esc(L.en)}</p>
<h1>${esc(p.bn)}</h1>
<p class="lead">${esc(p.about)}</p>
<div class="cta">${see}</div>
<h2>মনে রাখো</h2>
<ul class="facts">${p.points.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
<p class="word">${esc(p.meaning)}</p>
${AD_SLOT}
<h2>${esc(L.bn)}: আরও অংশ</h2>
<ul class="list">${mates.map(o => `<li><a href="${o.id}.html">${esc(o.bn)} <small>${esc(o.en)}</small></a></li>`).join("")}</ul>
<section class="rows">${promo("read", i)}</section>`;
  writeFileSync(join(root, `site/read/${p.id}.html`),
    page({ title: `${p.bn} (${p.en})`, desc: `${p.bn} (${p.en}): ${p.about} ${p.points.join("। ")}`, path: `read/${p.id}.html`, body }));
  urls.push(`read/${p.id}.html`);
});

const groups = Object.entries(content.layers).map(([k, L]) =>
  `<h2 id="${k}">${esc(L.bn)}</h2>
<ul class="list">${content.parts.filter(p => p.layer === k).map(p => `<li><a href="${p.id}.html">${esc(p.bn)} <small>${esc(p.en)}</small></a></li>`).join("")}</ul>`).join("\n");
writeFileSync(join(root, "site/read/index.html"), page({
  title: "মানবদেহের সব অংশ", path: "read/index.html",
  desc: "করোটির অস্থি, মস্তিষ্কের অংশ, মুখের পেশি ও হাতের অস্থির বাংলা ব্যাখ্যা। HSC জীববিজ্ঞান ও মেডিকেল ভর্তি প্রস্তুতির জন্য।",
  body: `<h1>মানবদেহের সব অংশ</h1>
<p class="lead">প্রতিটি অংশের নাম, কাজ আর মনে রাখার তথ্য। যেকোনো অংশ ৩ডি মডেলে ঘুরিয়ে দেখতে পারো।</p>
${groups}
${AD_SLOT}
<section class="rows">${promo("read")}</section>`,
}));

writeFileSync(join(root, "site/sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${BASE}${u}</loc></url>`).join("\n") + `\n</urlset>\n`);
console.log("reading pages:", content.parts.length + 1);
