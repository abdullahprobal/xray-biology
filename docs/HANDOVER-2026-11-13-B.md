# Handover 2026-11-13 (evening): X-ray Biology

Read first: this file, then `docs/HANDOVER-2026-11-13.md` (older context), `docs/SEO-PLAN.md`, `docs/PLAN-SEE-THROUGH.md`, `DESIGN.md`.

## Product and owner
Free Bangla camera-anatomy web app for HSC biology / medical admission students, by Board & Beyond (bandb.academy). Owner wants money fast via AdSense but without hurting the experience, short plain-language messages, and does not want to do technical work himself ("do everything, tell me where to click for human checks"). Never invent exam questions or statistics; biology text needs review by co-author Sidratul Saif.

## Live state (all pushed to `main` and `gh-pages`, last commit 0bd8a5f)
- **Address:** https://biology.bandb.academy (GitHub Pages, repo abdullahprobal/xray-biology, HTTPS enforced). DNS: CNAME `biology` -> abdullahprobal.github.io in Hostever cPanel zone for bandb.academy. Old github.io URL redirects.
- **Users reporting "can't be reached"** were typing `biology.banb.academy` (missing d). Not a site fault.
- **Pages:** policy pages (about, privacy, contact, terms), shared header/footer, robots.txt, 404, sitemap, ads.txt, og:image (`site/og.jpg`) for WhatsApp previews, JSON-LD (WebApplication, Article, BreadcrumbList).
- **Long reading pages:** 15 parts have 500+ word drafts in `content/pages/<id>.json` (heart, lungs, kidneys, stomach, liver, small/large intestine, pancreas, esophagus, trachea, cerebellum, medulla, ribs, vertebral-column, femur). Marked "draft, not reviewed" until `reviewed_by` is filled. Build renders them via `tools/build.mjs`.
- **Camera UI recent changes:** label names on dark plates; amber pulsing "ক্যামেরা চালু করো" button; see-through skull + X-ray film filter + "আমি ↔ হাড়" slider (`st.see`, default 0.3, saved as `xrb.see`); scan sweep + sound + buzz on first detection (`xrayWow`); quiz result has score-based promo (`quiz_low`/`quiz_high` in content/promos.json) and "স্কোরসহ ছবি শেয়ার" that puts a score badge on the photo.

## Google accounts (owner's Chrome, signed in as kmap.2030@gmail.com)
- **Search Console:** Domain property bandb.academy verified (DNS TXT). Sitemap https://biology.bandb.academy/sitemap.xml submitted and read OK.
- **AdSense:** publisher `pub-8098716292767078`. Site bandb.academy verified via bandb.academy/ads.txt (uploaded through cPanel), review requested 2026-11-13, payment profile completed by owner. Auto ads OFF for bandb.academy (main site must show no ads). Loader script only on biology reading pages.

## After AdSense approval (to do)
1. Create a display ad unit, paste its id into `QUIZ_AD_SLOT` in `site/app.js` (quiz result ad).
2. Turn on vignette (between-page) ads for the biology subdomain only.
3. Never ads over camera, 3D model, tours; no countdown/timed ads (owner agreed).

## Not verified / open
- Real-phone test of see-through look, slider, photo filter (canvas `filter` may not work on iOS Safari), quiz score badge, scan sound.
- 15 drafts await Sidratul Saif review. Next content: ~10 pages/week, difference tables ("artery vs vein"), process pages (see SEO-PLAN).
- Ideas offered, not built: first-use guide, daily challenge/streak.

## How to work
- Edit `content/*`, `tools/*`, `site/app.js`, `site/style.css`, `site/index.html`; never hand-edit `site/read/*` or `site/data/*`. Run `node tools/build.mjs`.
- Local test: `python -m http.server 8765 --directory site`, then `http://localhost:8765/index.html#test=_test/portrait.jpg` (test photos in git-ignored `site/_test/`). Browser pane is slow when hidden: wait 20-40 s.
- Publish: commit on `main`, `git push origin main`, then `git push origin "$(git subtree split --prefix site main)":refs/heads/gh-pages --force`.
- Writing files into the live WordPress (bandb.academy) through cPanel was blocked once by the safety check; ads.txt later succeeded after the owner's explicit approval.
