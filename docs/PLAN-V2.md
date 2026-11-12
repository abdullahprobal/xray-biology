# X-ray Biology: audit and version 2 plan

Project folder: `P:\Bandb Resources\biology-xray` · Live test site: `https://abdullahprobal.github.io/xray-biology/`
Written for an implementer (Opus 5.5) who has not seen the earlier conversation. First step after approval: save this file into the repo as `docs/PLAN-V2.md`.

## Context

Version 1 works: the camera finds head, hands and body and draws bones and organs on the student. Two phone screenshots from the owner show it does not yet look professional, and the owner asked for a hard audit, an AdSense path, and a plan that serves the real goal: **help students learn biology**. Today the product is an impressive toy with thin teaching content. Version 2 must fix the visible faults, then turn it into a study tool that earns search traffic.

## How the code is laid out today (read before changing anything)

| File | What it holds |
|---|---|
| `site/app.js` (~800 lines, one module) | Everything: data loading, three.js scenes, trackers, layout, labels, quiz, photo, deep links |
| `site/index.html`, `site/style.css` | Home page + viewer shell; design rules are in `DESIGN.md` (follow them) |
| `content/parts.json` | 51 parts and 9 layers (Bangla text). Source of truth; `site/data/` is a copy |
| `content/promos.json` | Promotion cards by slot |
| `tools/build.mjs` | Copies content, generates `site/read/*.html` and `sitemap.xml` |
| `tools/build_body.py` | Builds `site/assets/body.bin/.json` from `_work/bp3d` (BodyParts3D, not in git) |
| `site/assets/anatomy.*` | Head + hand models (from xray-mirror data, CC BY-SA) |

Key functions in `site/app.js`: `build()`, `buildBody()`, `placeBody()`, `poseFromFace()`, `poseBody()`, `poseHand()`, `orbitBody()`, `render()`, `tick()`, `collectDots()`, `bodyDots()`, `drawHud()`, `enter()`, `loadTrackers()`, `loadPose()`, `fakeCamera()`.
Coordinate systems: the head is drawn with a perspective camera (`headScene`, `cam`); hands and body are drawn in screen pixels with an orthographic camera (`handScene`, `ortho`). The canvas is mirrored with CSS in camera mode.
Test hook: `index.html#test=_test/pose.jpg` feeds a still photo in place of the camera (`site/_test/` is git-ignored).

## Audit

### A. The two reported faults

**A1. Neck drawn over the face (screenshot 2). Severity: high.**
Root causes, all in `site/app.js` and `tools/build_body.py`:
1. `render()` draws the head first, clears depth, then draws the body. So the body is always on top of the head.
2. The `spine` mesh includes the 7 neck vertebrae and `trachea` runs up to the throat. Nothing stops them at the neck.
3. Head and body are placed by two unrelated trackers in two coordinate systems. Nothing joins them.

**A2. Hand bones missing, arm bones in the wrong place (screenshot 1). Severity: high.**
What the screenshot shows: the "হাতের অস্থি" button looks switched off (same dim state as "চোখ"), so at that moment the hand layer was off. Separately, the forearm bones are drawn far from the real forearm. Causes to fix:
1. Nine layer buttons sit in one sideways-scrolling row. It is easy to switch one off without noticing, and the state is not obvious.
2. The body tracker guesses the arm badly at close range. We draw the guess even when its confidence is low.
3. Hand and body trackers take turns (every second frame each), so a moving, blurred hand is found less often than in version 1.
4. Hand tracker and body tracker are never reconciled: the forearm does not end where the hand begins.
5. There is no way to see on the phone which tracker loaded or failed.

### B. Other tracking and drawing faults
| # | Finding | Severity |
|---|---|---|
| B1 | Torso is flat: it narrows when the student turns but does not rotate | medium |
| B2 | No smoothing filter; bones jitter | medium |
| B3 | Labels: head and body names overlap each other; up to 20 names on screen | high |
| B4 | Three trackers at once; frame rate on cheap phones unknown, no automatic low-power mode | high |
| B5 | First use downloads about 25 MB from two outside servers with no progress bar and no offline cache | medium |
| B6 | Stale files: no version tag on `app.js`/`style.css`, so phones keep old code (owner had to refresh) | medium |
| B7 | Only the front camera. A back-camera switch would let a teacher or friend point the phone at someone | medium (cheap, high value) |
| B8 | Body view has no hand or skull link when far away; feet have one block, no toes | low |

### C. Experience
| # | Finding | Severity |
|---|---|---|
| C1 | No first-use guidance (stand back, tap a dot, try the quiz) | high |
| C2 | Layer row hides the body layers off-screen; no presets | high |
| C3 | Names are Bangla only on the model. Exams use the English terms | medium |
| C4 | Quiz is 8 random pointing questions: no levels, no explanation, nothing saved | high |
| C5 | Share is a photo only; a 5-second clip would spread better | low |
| C6 | Home page text still mentions a "শরীর" switch that no longer exists in camera mode | low |
| C7 | Errors raised inside the viewer are written to the hidden home page | medium |

### D. Learning value (the main goal)
| # | Finding | Severity |
|---|---|---|
| D1 | Each part has about 40 words. A student learns a name and three facts, nothing more | high |
| D2 | All biology text was written by the AI and is unreviewed. No textbook reference | high (trust) |
| D3 | It shows where things are, never how they work. No processes | high |
| D4 | No exam link: no board or admission questions anywhere | high |
| D5 | Not organised by HSC chapter | medium |
| D6 | Systems missing: blood vessels, nerves and spinal cord, body muscles, endocrine glands, reproductive system (model view only) | medium |
| D7 | Nothing brings a student back the next day | medium |

### E. AdSense and search readiness
| # | Finding | Severity |
|---|---|---|
| E1 | The site is on `github.io`. AdSense needs your own domain | blocker |
| E2 | 51 pages of about 60 words each is "thin content", the most common rejection reason | blocker |
| E3 | No Privacy Policy, About, Contact or Terms pages. The camera and ads both require a privacy page | blocker |
| E4 | Reading pages have no shared header or footer menu | high |
| E5 | No `ads.txt`, `robots.txt`, Search Console, analytics, structured data or share image | high |
| E6 | Canonical links already point to `bandb.academy/biology/`, which does not exist yet | medium |

### F. Engineering
| # | Finding | Severity |
|---|---|---|
| F1 | One 800-line file that was patched by scripts; hard to change safely | medium |
| F2 | One test photo; no fixed set of cases to re-check after a change | high |
| F3 | No usage numbers: we cannot see camera failures, load time or frame rate | high |
| F4 | `MODELS-LICENSE.md` does not mention `body.bin` (taken directly from BodyParts3D) | low |
| F5 | `#test=` accepts any address; limit it to same-site paths | low |

## AdSense: honest picture and requirements

Income per visit in Bangladesh is low, so ads will pay for little by themselves. They are still worth doing because the same work (many good Bangla pages) brings Google search traffic, and that traffic is what sells books and courses. Ads stay off the camera screen.

Before applying: own domain (E1), 60+ real pages (E2), the four policy pages (E3), site menu (E4), `ads.txt` at `bandb.academy/ads.txt` (E5). Apply once, when all are true; a rejected site waits weeks.

## What to write (content strategy)

Seven page types, all in Bangla with English terms, all generated from JSON by `tools/build.mjs`:

1. **Part pages** (have 51, thin): grow each to 500-800 words using the template below.
2. **Process pages** ("কীভাবে কাজ করে"): digestion step by step, the heart cycle, breathing, urine formation, a nerve impulse, bone joints. 12-15 pages. Each has a matching guided tour in the 3D view.
3. **Difference tables** ("পার্থক্য"): artery vs vein, small vs large intestine, cerebrum vs cerebellum, and so on. 15-20 pages. These are searched a lot before exams.
4. **Question pages**: per chapter, past board and medical admission questions with worked answers.
5. **Remember-it pages**: counts and mnemonics (206 bones broken down, cranial nerves, and so on).
6. **Word pages**: English term, Bangla meaning, word root. Natural link to StoryVocabs.
7. **Chapter hubs**: one page per HSC Biology 2nd paper chapter linking all of the above.

Part page template (one JSON object per part, new fields in `content/parts.json` or `content/pages/<id>.json`):
`intro` (2 sentences) · `location` · `structure` · `function` · `how_it_works` · `exam_facts[]` · `common_mistakes[]` · `mnemonic` · `questions[]` (question, options, answer, why, source) · `related[]` · `source` (NCTB chapter and page) · `reviewed_by`, `reviewed_on`.
Rule: nothing goes live with `reviewed_by` empty. No copying textbook sentences; write in our own words.

## Implementation plan

Work in this order. Each phase ends with its checks passing, a commit, and a push to both `main` and `gh-pages` (see "Publishing"). Do not start a phase before the one above it passes.

### Phase 0. Safety net (do first, half a day)
- **0.1 Test set.** Add 5 photos to `site/_test/` (git-ignored): close selfie, head and shoulders, half body with a raised open hand, full body front, full body turned 45°. Use MediaPipe's public sample images from `storage.googleapis.com/mediapipe-assets/`. Write `docs/TESTING.md` listing each case and what must be true.
- **0.2 Debug readout.** `#debug` in the address shows a small text block (frames per second, which trackers are loaded and on which delegate, what was found this frame, shoulder and wrist confidence). Implement inside `drawHud()`.
- **0.3 Version tags.** `tools/build.mjs` writes `?v=<short hash of file>` onto `app.js`, `style.css` and data file addresses in every HTML file. (fixes B6)
- **0.4 Split `site/app.js`** into ES modules without changing behaviour: `js/scene.js` (three.js, materials, unpack), `js/head.js`, `js/hands.js`, `js/body.js`, `js/trackers.js`, `js/hud.js` (dots, labels), `js/ui.js` (chips, card, quiz, photo), `js/main.js`. No bundler. Check all 5 photos look the same before and after. (F1)

### Phase 1. Make the camera view correct (the reported faults)
- **1.1 Cut the neck off the torso** in `tools/build_body.py`: split `spine` faces at torso height `y > 1.04` into a new mesh `neck`; clip `trachea` and the esophagus part of `stomach` at the same height (drop the upper part into `neck_soft`). Store both as "limb" style pieces with a start point (base of neck) and an end point (top of the first vertebra). Rebuild `body.bin`. (A1)
- **1.2 Join neck to head.** In `js/body.js`: start point = base of neck from the torso matrix. End point = skull base from the head: take head point `(0, -1.5, -5.5)` (cm, head space), apply `headM` and `cam.projectionMatrix`, convert to screen pixels. Stretch the neck piece between the two, same maths as `poseBody()` uses for limbs. If the head is not tracked, draw the neck at its rest length straight up from the torso. (A1)
- **1.3 Draw order.** `render()` becomes three passes with depth cleared between: body (ortho) → head (perspective) → hands (ortho). Move body groups to their own `bodyScene`. In solid style the head must hide what is behind it: draw the head `skin` mesh to depth only (`colorWrite = false`) before the head layers. (A1)
- **1.4 Hide body dots under the head.** In `bodyDots()`, skip a dot that falls inside the head's screen box when the head is tracked.
- **1.5 Only draw what we trust.** In `poseBody()`: draw a limb only if both joints have confidence ≥ 0.6 and lie inside the picture (2% margin). Otherwise hide the limb and its dark shade. (A2)
- **1.6 Reconcile hand and arm.** When the hand tracker finds a hand, match it to the nearer body wrist (landmark 15 or 16). Replace that wrist position with the hand's wrist (hand landmark 0) before building the forearm. If the elbow confidence is below 0.5, hide the forearm instead of guessing. (A2)
- **1.7 Tracker scheduling.** Face every frame. If a hand was seen in the last 500 ms, run hands every frame and the body every third frame; otherwise body every frame and hands every third. Remove the fixed even/odd turn. (A2, B4)
- **1.8 Smoothing.** Add a One-Euro filter (about 30 lines, `js/filter.js`) for body and hand landmarks; replace the fixed `lerp` calls. (B2)
- **1.9 Layer control.** Replace the single scrolling row with two fixed rows: "মাথা" (করোটি, মস্তিষ্ক, পেশি, চোখ, হাত) and "শরীর" (কঙ্কাল, হৃৎপিণ্ড-ফুসফুস, পরিপাক, রেচন). An "on" button is filled, an "off" one is outlined, so state is obvious. Save `st.layers` in `localStorage` (wrapped in try/catch). Add a "সব" (all on) reset. (A2, C2)
- **1.10 Label budget.** At most 8 names at once. Priority: the selected part, then the layer switched on most recently, then nearest to screen centre. Others show the dot only. Name toggle gets three states: বাংলা / English / বন্ধ. (B3, C3)
- **1.11 Errors in the viewer** show in the `#hint` line, not on the hidden home page. (C7)

Checks: on all 5 photos nothing from the body is drawn over the face; no bone is drawn where there is no limb; the raised hand shows all 5 fingers including the thumb; labels never overlap; turning each layer on and off works; state survives a reload. Then the owner checks on his phone with `#debug` on and sends one screenshot.

### Phase 2. Make it run well everywhere
- **2.1 Automatic low-power mode.** Measure frame rate for the first 3 seconds. Under 15: camera at 640×480, pixel ratio 1, body tracker every third frame, hand tracker only when the hand layer is on. Show a one-line note. (B4)
- **2.2 Loading.** A real progress line while models download ("৩ এর ২: শরীরের মডেল"). Add a service worker (`site/sw.js`) that caches our files and the CDN tracker files after first use, so the second visit is instant and works offline. Self-host three.js in `site/vendor/`. (B5)
- **2.3 Back camera switch.** A button that reopens the stream with `facingMode: "environment"`, stops the old stream first, and turns mirroring off. (B7)
- **2.4 Torso turning.** Use the body tracker's `worldLandmarks` to get the 3D directions of the shoulder line and the spine. Build the torso basis from those directions, scaled to the on-screen shoulder width and torso height. Fall back to the flat method when the directions are unreliable. Test with the 45° photo. (B1)
- **2.5 First-use guide.** Three short tips shown once, each with a "বুঝেছি" button: stand back to see the body, tap a dot, try the quiz. (C1)
- **2.6 Usage numbers.** Add privacy-friendly analytics (GA4, since AdSense needs it later). Events: camera start ok or failed (with reason), load time, frame-rate bucket, layer toggles, card opens, quiz finished with score, promo clicks by slot, share. No video, no images, no personal data. (F3)

Checks: frame rate in `#debug` on the owner's phone and one cheap Android; second visit loads with mobile data off; back camera shows a friend correctly (not mirrored).

### Phase 3. Teach, not just show
- **3.1 Process tours.** New `content/tours.json`: each tour is a list of steps `{parts:[...], caption_bn, seconds}`. In the viewer a tour dims everything, pulses the step's meshes (new `uPulse` uniform in the shader), shows the caption, and has next/back. First six tours: food's path, blood through the heart, a breath in and out, urine from kidney to bladder, how the arm bends (humerus, radius, ulna), the skull's bones one by one. (D3)
- **3.2 Rich part cards.** Card shows: what it is, where it is, what it does, "পরীক্ষায় যা আসে", one question to try, and links to the reading page and related parts. Data from the template above. (D1, D4)
- **3.3 Quiz that teaches.** Three kinds: point to it, name what is highlighted (4 choices), and text MCQ from `questions[]`. Every answer shows a one-line "কেন". Levels by chapter. Score, streak and weak parts saved in `localStorage`; "আজকের ৫টি" daily set picks from weak parts first. (C4, D7)
- **3.4 Chapter menu.** Entry by HSC chapter: choosing "রক্ত ও সঞ্চালন" turns on the right layers and lists its parts, tours and quiz. (D5)
- **3.5 More anatomy** from `_work/bp3d` via `tools/build_body.py`: aorta and main vessels, spinal cord and brain stem link, diaphragm, main body muscles as one layer. Reproductive system in model view only, never on the camera. (D6)
- **3.6 Expert review gate.** `tools/build.mjs` refuses to publish a part or tour whose `reviewed_by` is empty (prints the list). The biology co-author reviews in a simple checklist file `docs/REVIEW.md`. (D2)

Checks: each tour plays start to finish on the model view and on a test photo; quiz results persist after reload; build fails when a part is unreviewed.

### Phase 4. Content for search and AdSense
- **4.1 Page builder.** Extend `tools/build.mjs` to the seven page types, each with: shared header and footer menu, breadcrumb, a live 3D viewer block for that part (`index.html#part=<id>` in an iframe or inline), related links, FAQ, and JSON-LD (`Article`, `FAQPage`, `BreadcrumbList`). Share image per page made from a model snapshot. (E2, E4, E5)
- **4.2 Write the pages** in this order: grow the 51 part pages → 12 process pages → 15 difference tables → chapter hubs → question pages → word pages. Target 100 pages, each 500+ words, each reviewed.
- **4.3 Policy pages**: `privacy.html` (camera stays on the device, analytics, ads and cookies), `about.html`, `contact.html`, `terms.html`. Linked in every footer. (E3)
- **4.4 Site files**: `robots.txt`, `sitemap.xml` with all pages, `ads.txt` (placed at the domain root), 404 page.
- **4.5 Ad slots.** Two fixed-height slots on reading pages (after the first section, and at the end) so the page does not jump. None in the viewer, cards, quiz or tours. Use non-personalised ads.

### Phase 5. Launch on the real address
- **5.1** Upload `site/` to `bandb.academy/biology` on Hostever; `biology.bandb.academy` forwards to it. Check `.htaccess` compression and caching work there.
- **5.2** Search Console: verify, submit sitemap. Analytics live.
- **5.3** Apply to AdSense only when E1-E5 are all done and at least 60 reviewed pages are indexed.
- **5.4** Book marketing: a QR code to `bandb.academy/biology` on an inside-front page of each science Board Radar book, with one line of copy and a screenshot.
- **5.5** Update `README.md`, `DESIGN.md`, `MODELS-LICENSE.md` (add `body.bin` source). (F4)

## Rules for the implementer
- Edit source (`content/*.json`, `tools/*`, `site/js/*`), never the generated `site/read/` or `site/data/`. Run `node tools/build.mjs` after content changes and `python -I tools/build_body.py _work/bp3d site/assets` after model changes.
- Follow `DESIGN.md`: black film, bone white, one amber accent, hairline rows, 4px corners, no cards or pills.
- Never invent a board or admission question or a statistic. If the data is missing, leave the field empty.
- Bangla text: plain, short sentences, English term in brackets on first use.
- No video or image ever leaves the phone.
- Use relative links everywhere so the site works in a sub-folder.
- Commit messages describe the change; keep the existing co-author line convention.

## Publishing (test site)
```bash
git add -A
```
```bash
git commit -m "<message>"
```
```bash
git push origin main
```
```bash
git push origin "$(git subtree split --prefix site main)":refs/heads/gh-pages --force
```

## Decisions needed from the owner (defaults in brackets)
1. Past question source for HSC boards and medical admission. [None available yet: question pages wait; cards use only reviewed own-written MCQs.]
2. Who reviews the biology text. [The biology co-author, Sidratul Saif.]
3. When to move to `bandb.academy/biology`. [After Phase 2, so real students can test early.]
4. Exact book and course links for the promotion cards. [Home page until supplied.]

## Verification (end to end)
1. `python -m http.server 8765 --directory site`, open `http://localhost:8765/index.html#test=_test/<photo>&debug` for each of the 5 photos; compare against `docs/TESTING.md`.
2. Model view: `#model` and `#model=body`; open a part by `#part=heart`; play each tour.
3. Phone size (375×812) screenshots of home, viewer, card, quiz result, one reading page; check against `DESIGN.md`.
4. Console has no errors; `node --check` passes on every module; `node tools/build.mjs` exits clean.
5. Owner tests on his phone after Phases 1 and 2 with `#debug` and reports frame rate and one screenshot.
6. Before AdSense: Google Rich Results test on three pages, mobile-friendly check, all footer policy links work.
