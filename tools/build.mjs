// Builds the reading pages and copies content into site/. Run: node tools/build.mjs
// Edit content/parts.json and content/promos.json, never the generated files in site/read or site/data.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://biology.bandb.academy/";
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
const AD_SLOT = `<div class="ad" aria-label="বিজ্ঞাপন"><!-- AdSense slot --></div>`;

const MENU = up => `<header class="sitetop"><a class="brand" href="${up}index.html">এক্স-রে বায়োলজি</a><nav class="menu"><a href="${up}index.html">ক্যামেরা</a><a href="${up}read/index.html">পড়ো</a><a href="${up}about.html">পরিচিতি</a><a href="${up}contact.html">যোগাযোগ</a></nav></header>`;
const FOOT = up => `<footer class="sitefoot"><p><a href="${up}about.html">আমাদের কথা</a> · <a href="${up}privacy.html">গোপনীয়তা নীতি</a> · <a href="${up}terms.html">শর্তাবলী</a> · <a href="${up}contact.html">যোগাযোগ</a></p><p>© Board &amp; Beyond · <a href="https://bandb.academy/">bandb.academy</a></p></footer>`;
const page = ({ title, desc, path, body, up = "../" }) => `<!doctype html>
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
<link rel="stylesheet" href="${up}style.css">
</head>
<body class="read">
${MENU(up)}
<main>
${body}
<p class="fine">এই লেখা এখনো বিশেষজ্ঞের পর্যালোচনা হয়নি। এটি শেখার সহায়ক। পরীক্ষার জন্য তোমার পাঠ্যবইয়ের সাথে মিলিয়ে নাও।</p>
<p class="fine">Anatomy models: BodyParts3D, © The Database Center for Life Science, CC Attribution-Share Alike 2.1 Japan.</p>
</main>
${FOOT(up)}
</body>
</html>
`;

const urls = ["", "read/index.html", "about.html", "privacy.html", "contact.html", "terms.html"];
const SITE = {
about: ["আমাদের কথা", "এক্স-রে বায়োলজি কী, কারা বানিয়েছে এবং কীভাবে শেখায়।", `<h1>আমাদের কথা</h1>
<p class="lead">এক্স-রে বায়োলজি একটি বিনামূল্যের বাংলা ওয়েবসাইট। ফোনের ক্যামেরা তোমার মাথা, হাত আর শরীর খুঁজে নিয়ে তার ওপর হাড়, মস্তিষ্ক, পেশি আর অঙ্গ আঁকে। যেকোনো বিন্দুতে চাপ দিলে বাংলায় নাম, কাজ আর মনে রাখার তথ্য আসে।</p>
<h2>কার জন্য</h2><p>HSC জীববিজ্ঞান এবং মেডিকেল ভর্তি পরীক্ষার শিক্ষার্থীদের জন্য। ছবি দেখে ও নিজের শরীরে খুঁজে শিখলে মনে থাকে বেশি।</p>
<h2>কারা বানিয়েছে</h2><p>সাইটটি Board &amp; Beyond (<a href="https://bandb.academy/">bandb.academy</a>) এর একটি উদ্যোগ। Board &amp; Beyond SSC ও HSC শিক্ষার্থীদের জন্য অনলাইন কোর্স ও বই তৈরি করে।</p>
<h2>লেখা কতটা নির্ভরযোগ্য</h2><p>পাতার লেখাগুলো এখনো জীববিজ্ঞান বিশেষজ্ঞের পর্যালোচনার অপেক্ষায়। পরীক্ষার জন্য সবসময় এনসিটিবি পাঠ্যবইয়ের সাথে মিলিয়ে নাও। ভুল পেলে আমাদের জানাও, ঠিক করে দেব।</p>
<h2>খরচ</h2><p>সাইটটি শিক্ষার্থীদের জন্য সবসময় বিনামূল্যে। খরচ চালাতে পড়ার পাতায় বিজ্ঞাপন দেখানো হয় এবং Board &amp; Beyond এর কোর্স ও বইয়ের কথা জানানো হয়।</p>
<h2>৩ডি মডেল</h2><p>মডেলগুলো BodyParts3D থেকে নেওয়া (© The Database Center for Life Science, CC Attribution-Share Alike 2.1 Japan)। আমরা সেগুলো সরল করে সাজিয়েছি।</p>`],
privacy: ["গোপনীয়তা নীতি", "ক্যামেরা, কুকি, বিজ্ঞাপন ও তথ্য নিয়ে আমাদের নীতি।", `<h1>গোপনীয়তা নীতি</h1>
<p class="lead">তোমার ক্যামেরার ভিডিও কখনো তোমার ফোন থেকে বের হয় না। সব বিশ্লেষণ ফোনের ব্রাউজারেই হয়।</p>
<h2>ক্যামেরা</h2><p>ক্যামেরা চালু করলে ব্রাউজার অনুমতি চায়। ভিডিও শুধু তোমার ফোনেই প্রক্রিয়া হয়। আমরা কোনো ভিডিও বা ছবি সংগ্রহ, সংরক্ষণ বা আপলোড করি না। "ছবি" বোতামে তোলা ছবি তোমার ফোনেই থাকে, তুমি নিজে শেয়ার করলে তবেই অন্যের কাছে যায়।</p>
<h2>তোমার ফোনে রাখা তথ্য</h2><p>লেয়ার বা নামের পছন্দ ফোনের localStorage এ রাখা হয়, যাতে পরের বার মনে থাকে। ব্রাউজারের ডেটা মুছলে এগুলো চলে যায়।</p>
<h2>বিজ্ঞাপন ও কুকি</h2><p>এই সাইটের পড়ার পাতায় Google AdSense এর বিজ্ঞাপন দেখানো হতে পারে। Google ও তাদের অংশীদাররা কুকি বা অনুরূপ প্রযুক্তি ব্যবহার করে তোমার আগের ভিজিটের ভিত্তিতে বিজ্ঞাপন দেখাতে পারে। তুমি <a href="https://adssettings.google.com/">Google Ads Settings</a> থেকে ব্যক্তিগতকৃত বিজ্ঞাপন বন্ধ করতে পারো। আরও জানতে দেখো <a href="https://policies.google.com/technologies/ads">Google এর বিজ্ঞাপন নীতি</a>। ক্যামেরা, কার্ড, কুইজ ও ৩ডি দৃশ্যে কোনো বিজ্ঞাপন নেই।</p>
<h2>বাইরের লিঙ্ক</h2><p>আমরা bandb.academy ও storyvocabs.com এর লিঙ্ক দেখাই। ওই সাইটগুলোর নিজস্ব নীতি আছে।</p>
<h2>ব্যক্তিগত তথ্য</h2><p>আমরা কারো নাম, ইমেইল বা ফোন নম্বর চাই না বা সংগ্রহ করি না।</p>
<h2>যোগাযোগ</h2><p>প্রশ্ন থাকলে <a href="contact.html">যোগাযোগ</a> পাতা দেখো। নীতি বদলালে এই পাতায় জানানো হবে।</p>`],
contact: ["যোগাযোগ", "ভুল জানাতে বা প্রশ্ন করতে Board & Beyond এর সাথে যোগাযোগ।", `<h1>যোগাযোগ</h1>
<p class="lead">লেখায় ভুল পেলে, কোনো অংশ বুঝতে সমস্যা হলে বা পরামর্শ থাকলে আমাদের জানাও।</p>
<h2>কোথায় জানাবে</h2><ul class="facts"><li>ওয়েবসাইট: <a href="https://bandb.academy/">bandb.academy</a></li><li>Board &amp; Beyond এর Facebook পেজে মেসেজ দাও</li><li>কোড ও ভুলের তালিকা: <a href="https://github.com/abdullahprobal/xray-biology/issues">GitHub</a></li></ul>
<p>ভুল জানানোর সময় পাতার নাম লিখো। আমরা যাচাই করে ঠিক করব।</p>`],
terms: ["শর্তাবলী", "এই সাইট ব্যবহারের শর্ত।", `<h1>শর্তাবলী</h1>
<p class="lead">এই সাইট শেখার জন্য বিনামূল্যে ব্যবহার করা যায়।</p>
<h2>চিকিৎসা নয়</h2><p>এখানে দেখানো গঠন একজন প্রাপ্তবয়স্ক মানুষের আদর্শ মডেল, তোমার নিজের স্ক্যান নয়। এটি রোগ নির্ণয় বা চিকিৎসার জন্য নয়।</p>
<h2>লেখার নির্ভুলতা</h2><p>আমরা সঠিক রাখার চেষ্টা করি, তবে পরীক্ষার জন্য এনসিটিবি পাঠ্যবই চূড়ান্ত। ভুলের কারণে কোনো ক্ষতির দায় আমরা নিই না।</p>
<h2>ব্যবহার</h2><p>সাইট ব্যক্তিগত শিক্ষার জন্য ব্যবহার করো। আমাদের লেখা অনুমতি ছাড়া নিজের নামে প্রকাশ বা বিক্রি কোরো না। ৩ডি মডেলের লাইসেন্স CC BY-SA 2.1 Japan।</p>
<h2>বাইরের সাইট</h2><p>অন্য সাইটের লিঙ্ক ও বিজ্ঞাপনের বিষয়বস্তুর দায় ওই সাইটের।</p>`] };
for (const [k, [t, d, b]] of Object.entries(SITE))
  writeFileSync(join(root, `site/${k}.html`), page({ title: t, desc: d, path: `${k}.html`, up: "", body: b }));
writeFileSync(join(root, "site/404.html"), page({ title: "পাতা পাওয়া যায়নি", desc: "এই পাতা নেই।", path: "404.html", up: "/",
  body: `<h1>পাতা নেই</h1><p class="lead">এই ঠিকানায় কিছু পাওয়া গেল না।</p><div class="cta"><a class="btn primary" href="/index.html">ক্যামেরায় ফিরে যাও</a> <a class="btn" href="/read/index.html">সব অংশ পড়ো</a></div>` }));
writeFileSync(join(root, "site/robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}sitemap.xml\n`);
content.parts.forEach((p, i) => {
  const L = content.layers[p.layer];
  const mates = content.parts.filter(o => o.layer === p.layer && o.id !== p.id);
  const see = !p.hand
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

// Version tag: one short hash of everything a phone downloads, stamped on app.js and style.css links,
// so a phone never mixes old and new files. app.js passes the same tag on to its data requests.
const hash = createHash("sha1");
for (const f of ["site/app.js", "site/style.css", "site/data/parts.json", "site/data/promos.json",
                 "site/assets/anatomy.json", "site/assets/anatomy.bin", "site/assets/body.json", "site/assets/body.bin"]) hash.update(readFileSync(join(root, f)));
const VER = hash.digest("hex").slice(0, 8);
const stamp = html => html.replace(/(href|src)="((?:\.\.\/)?(?:style\.css|app\.js))(?:\?v=\w+)?"/g, `$1="$2?v=${VER}"`);
for (const f of ["site/index.html", "site/404.html", ...["about", "privacy", "contact", "terms"].map(x => `site/${x}.html`), ...readdirSync(join(root, "site/read")).filter(x => x.endsWith(".html")).map(x => "site/read/" + x)]) {
  const path = join(root, f); writeFileSync(path, stamp(readFileSync(path, "utf8")));
}
console.log("version:", VER);
