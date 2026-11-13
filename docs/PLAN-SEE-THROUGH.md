# Plan: "it's me, with bones inside" (2026-11-13)

Problem: in camera mode a dark veil (alpha 0.86) covers the face and dark paint (0.74-0.78) covers body and hands, so every photo looks like the same stock skull. Students cannot see it is them, so photos do not get shared.

Goal: the student's own face, hair, glasses and clothes stay recognisable; bones and organs glow on top like a real X-ray of that person.

## Changes
1. **X-ray film look on the camera picture** (style.css, `.film video`): grayscale, a cool blue tint, more contrast, slightly darker. The person stays recognisable but the picture reads as film, so glowing bones stand out without hiding the face. Only in camera mode with the X-ray style; solid style keeps the normal colour picture.
2. **See-through veil and shade** (app.js): one value `st.see` (0 = "more me", 1 = "more bones") drives the veil alpha over the face (0.2 to 0.85) and the dark paint over body and hands (0.2 to 0.78). Default 0.4: face clearly visible, bones still clear.
3. **Slider "আমি ↔ হাড়"** in the camera controls, saved per phone (`xrb.see`). Hidden in model mode and solid style.
4. **Photo matches the screen**: the snapshot applies the same film filter to the camera frame (canvas `filter`; on browsers without it the photo keeps normal colour, which is still recognisable).
5. Finish the stopped work: X-ray scan sweep and sound on first detection, quiz score badge on the photo; remove the debug log and leftover code.

## Not changing
Bone shapes, tracking, label plates, quiz, layer rows.

## Test
Test photos in `site/_test/` at phone size: face recognisable at default, slider ends behave, photo output matches the screen, no console errors. Then publish to `main` and `gh-pages`.
