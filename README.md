# X-ray Biology (Board & Beyond)

Free Bangla anatomy mirror for HSC biology and medical admission students.
Planned address: `bandb.academy/biology`.

## Folders
- `site/` : the finished website. Upload everything inside it to the `/biology` folder on the host.
- `content/parts.json` : every body part (Bangla name, text, facts). Edit here.
- `content/promos.json` : promotion cards for books, courses and StoryVocabs. Edit here.
- `tools/build.mjs` : makes the reading pages. Run after any content change.
- `tools/extract_models.py` : how the 3D model data was taken from the xray-mirror page.

## Change content
```bash
node tools/build.mjs
```

## Try it on this computer
```bash
python -m http.server 8765 --directory site
```
Then open http://localhost:8765 in Chrome. The camera only works on `localhost` or `https`.

## Links for books and QR codes
- `index.html#part=mandible` opens the 3D model with that part selected (ids are in `content/parts.json`).
- `index.html#model` opens the 3D model without the camera.

## Licence
3D model data: BodyParts3D, CC BY-SA 2.1 Japan (see `MODELS-LICENSE.md`). Code and text: © Board & Beyond.
