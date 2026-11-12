# SEO plan: biology.bandb.academy (written 2026-11-13)

Goal: students (HSC biology, medical admission) find the site before they look for it, and Google shows it on page one for the questions they type. "TG" below means target group; Telegram is one of the channels.

## Honest expectations
- Nobody can promise #1. A new subdomain has no trust yet. Realistic: indexed in days, first long-tail impressions in 4-8 weeks, page one for specific questions in 2-4 months, harder terms in 6-12 months.
- Our edge: the camera X-ray is rare, shareable and free; Bangla anatomy pages with real diagrams are thin everywhere. Compete on specific questions first, not on "জীববিজ্ঞান".
- Biggest risk: 51 short AI-written pages. Google treats mass thin or unreviewed pages as low quality, and AdSense rejects them. Quality before volume.

## What the TG types (keyword map, confirm with Search Console data)
| Intent | Example query shape | Page type | URL pattern |
|---|---|---|---|
| Part facts | "হৃৎপিণ্ডের গঠন ও কাজ", "femur bangla" | Part page (have 51) | /read/heart.html |
| Difference | "ধমনী ও শিরার পার্থক্য", "ক্ষুদ্রান্ত্র বৃহদন্ত্র পার্থক্য" | Table page (most searched before exams) | /differences/artery-vs-vein.html |
| Process | "হৃৎস্পন্দন কীভাবে হয়", "মূত্র তৈরির ধাপ" | Process page + 3D tour | /how/heart-cycle.html |
| Memory | "মেডিকেল ভর্তি অস্থি সংখ্যা মনে রাখার উপায়" | Remember page | /remember/206-bones.html |
| Chapter | "HSC জীববিজ্ঞান ২য় পত্র অধ্যায় ৪" | Chapter hub linking all above | /chapters/ch4.html |
| Brand | "এক্স-রে বায়োলজি", "ক্যামেরায় নিজের হাড় দেখা" | Home | / |
Rules: one main query per URL; no two pages chase the same query. Write spelling variants in the text (হৃৎপিণ্ড / হৃদপিণ্ড / হার্ট, Bangla plus English term, common transliterations). Slugs stay English.

## Phase A: technical base (done or doing now)
- [x] Subdomain with HTTPS, canonical on every page, sitemap, robots.txt, 404, policy pages, header and footer.
- [x] Structured data: WebApplication (home), BreadcrumbList and Article (parts), breadcrumbs on the list page. Open Graph tags.
- [ ] Owner: Search Console "Domain" property for bandb.academy (DNS TXT in Hostever), submit `https://biology.bandb.academy/sitemap.xml`. Same in Bing Webmaster Tools (Bing also feeds some voice and chat answers).
- [ ] Add `lastmod` to the sitemap from git dates; IndexNow ping after each publish (optional).
- [ ] Core Web Vitals check on the home page with PageSpeed Insights (mobile). Home loads 3D plus tracking code: load MediaPipe only after the student taps the camera button if LCP is above 2.5 s. Reading pages are light.
- [ ] Better titles: `হৃৎপিণ্ডের গঠন ও কাজ (Heart) | HSC জীববিজ্ঞান` pattern, 50-60 characters, query words first; description 120-160 characters, unique per page.
- [ ] Images: render one PNG per part from the 3D model with Bangla alt text, plus `og:image` for sharing. Anatomy is image-heavy; Google Images and shared links both need pictures.
- [ ] Reading pages must not rely on JavaScript for text (already true).

## Phase B: content that deserves to rank (weeks 1-8)
1. Rewrite the 15 highest-demand part pages first (heart, lungs, brain parts, kidneys, stomach, liver, intestines, skull bones, ribs, spine) to 500-800 words with the PLAN-V2 template: intro, location, structure, function, how it works, exam facts, common mistakes, mnemonic, related parts, NCTB source.
2. Then 10 difference pages and 6 process pages (each linked to its 3D tour).
3. Every page shows "Reviewed by Sidratul Saif, date" once he has checked it. Unreviewed pages stay marked and, if Google starts ignoring them, set `noindex` until reviewed. Biology text is health-adjacent, so a named expert reviewer is the strongest trust signal we can add. No invented exam questions or statistics.
4. Own words only; no copied textbook sentences.
5. Chapter hubs per HSC chapter linking every related page; homepage links to the hubs. Every page reaches the home and its hub in one click; "related" links use descriptive anchors.

## Phase C: be found before the student searches (start in week 1, runs forever)
The student's journey starts on Facebook, YouTube and Telegram, then moves to Google. Be there first.
- Demo reel (15-30 s): "ক্যামেরায় নিজের হাড় দেখো" on Facebook, YouTube Shorts, TikTok. The camera effect is the hook; end card shows biology.bandb.academy. Post one reel per body system.
- Telegram and Facebook groups for HSC and medical admission: post one useful diagram or difference table per day with the page link; never spam.
- Board & Beyond assets: link from the bandb.academy homepage, course pages and books (these links carry the most authority; a subdomain does not inherit it automatically), from storyvocabs.com, YouTube descriptions, Facebook page about section and pinned post.
- Built-in loop: the photo button stamps `biology.bandb.academy`; add "share this page" on reading pages and a challenge line ("আমি কুইজে ১০/১২ পেয়েছি").
- Teachers and coaching centres: a one-page class guide (QR code) for biology teachers.
- Timing: finish the exam-relevant pages 2-3 months before the HSC and medical admission seasons, because people search just before exams.

## Phase D: measure and repeat (monthly)
- Search Console: impressions, clicks, average position per page and query; pages stuck at positions 8-20 get rewritten and linked more; queries with impressions but no page become new pages.
- Analytics: add only a light, cookie-free tool, and update the privacy page when added.
- Targets (guide, not promise): month 1 all pages indexed, month 2 first 100 impressions per day, month 4 first page-one results for 5+ long-tail queries, month 6 steady daily visitors that outnumber social referrals.
- AdSense: apply only when 20+ pages are 500+ words and reviewed; keep ads on reading pages only.

## Do not
Buy backlinks, copy competitor text, stuff keywords, make doorway pages for every spelling, mark FAQ schema where no FAQ exists, or index pages that are still thin.
