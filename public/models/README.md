# Rider model

Drop a glTF binary here as `cyclist.glb` and every avatar in the indoor
world becomes that model. Leave it empty and the world falls back to the
primitive rider built in code, so nothing is blocked on art arriving.

## What the loader expects

- **`cyclist.glb`** — glTF 2.0 binary.
- Facing **+Z**, standing on **y = 0**, roughly **1.7 m** tall. The world is
  in metres; a model authored in centimetres arrives a hundred times too big.
- The **first animation clip** is played as the pedalling loop, and its speed
  is driven by real cadence — one clip revolution should be one crank
  revolution, or the legs will not match the numbers on screen.
- Skinned meshes are cloned with their own skeleton per rider, so riders do
  not pedal in lockstep.

## Before using a model you found online

Check the licence, every time, on the model's own page:

- **CC0** — no conditions.
- **CC-BY** — free to use commercially, but attribution is required and must
  appear somewhere a user can find it.
- **Editorial / personal use only** — cannot ship in this app.
- **Paid / royalty-free** — read what the licence covers; some exclude apps
  that are themselves sold or subscribed to.

FORGE is intended as a commercial product, so a model that is free for a
hobby project is not automatically free for this one. When in doubt, buy the
commercial licence or commission the model.

## Performance

A group ride may hold dozens of riders on screen at once. Keep the model
**under roughly 30k triangles** and to **one material**; a 500k-triangle
scan will look better standing still and drop the frame rate through the
floor the moment a bunch forms.
