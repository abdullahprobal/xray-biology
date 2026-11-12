# Design: X-ray Biology

**One thing to remember:** "I saw inside my own head."

## Direction: radiograph film
The product is an X-ray, so the whole site is the film: black, with bone-white light. The 3D model is the only image and it is always on screen, including the home page. Nothing decorates; lines and type do the work.

## Why the first version felt cheap
1. The home page described the product instead of showing it.
2. Navy background with cyan buttons is the default "AI app" look.
3. Everything sat in rounded cards and pills, so nothing was more important than anything else.
4. One font at similar sizes, no strong headline.
5. Labels on the model were black pills that looked like debug output.
6. Promotion cards appeared before the student had seen anything good.

## Colour
| Name | Value | Use |
|---|---|---|
| film | `#050607` | every background |
| bone | `#f1ece0` | text, the main button |
| dim | `#98948a` | secondary text |
| line | `#2a2925` | hairlines between rows |
| lamp | `#ffb02e` | the only accent: selected part, quiz progress, warnings, promo links |

Layer colours (skull, brain, muscles, eyes) appear only on the model and as a small dot beside the layer name.

## Type
- **Anek Bangla** 700-800, slightly condensed: headlines and all controls.
- **Hind Siliguri** 400-600: reading text.
- **JetBrains Mono**, small capitals: English anatomical names, like the markers printed on a real film.

## Layout rules
- Left aligned. No centred blocks.
- Rows separated by hairlines, not cards.
- Corners 4px. No pills, no glows, no gradients except the fade that keeps text readable over the model.
- One filled button per screen (bone on black). Everything else is text or an outlined box.
- One promotion per screen, never over the live camera.

## Model labels
Thin ring, small coloured centre, a leader line and the Bangla name. Selected part turns lamp amber.
