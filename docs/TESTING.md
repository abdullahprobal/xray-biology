# Testing the camera view

The camera can be replaced by a still photo: open
`http://localhost:8765/index.html#test=_test/<photo>&debug`
after starting the local server with `python -m http.server 8765 --directory site`.
`#debug` shows frame rate, which processor each tracker runs on, what was found, and tracker confidence.
On a phone, add `#debug` to the live address to see the same readout.

Test photos live in `site/_test/` (not committed). They are MediaPipe's public samples from
`https://storage.googleapis.com/mediapipe-assets/<name>`.

| Photo | Case | Must be true |
|---|---|---|
| `portrait.jpg` | head and shoulders, arms crossed | head found; ribs, heart, lungs on the chest; neck ends under the jaw; nothing from the body drawn over the face |
| `woman_hands.jpg` | close, both hands raised near the face | both hands found with all five fingers; trunk upright (not sideways); no bone where there is no arm |
| `pose.jpg` | full body, face turned sideways | body found without the face; arm, leg and foot bones on the limbs; neck stops at the chin |
| `thumb_up.jpg` | one hand close to the camera | hand bones including the thumb |
| `left_hands.jpg`, `right_hands.jpg` | single hand | hand bones on the right side |

Not yet covered: a full body facing the camera, and a body turned 45 degrees (needed for the torso-turning work in Phase 2).

Also check after any change: the layer buttons show on/off clearly and survive a reload; at most 8 names on screen; the name button cycles বাংলা / English / নাম বন্ধ.
