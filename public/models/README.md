# 3D assets for the indoor world

Everything here is optional. The world is generated from the course's own
geometry and ships working without a single file in this folder — drop art in
and it upgrades itself. Nothing is ever blocked on assets arriving.

There are two kinds of file the world looks for.

## 1. The rider — `cyclist.glb`

Replaces the primitive rider on every avatar.

- **glTF 2.0 binary** (`.glb`, not `.gltf` with side files).
- Facing **+Z**, standing on **y = 0**, about **1.7 m** tall including the
  bike. The world is in metres; a model authored in centimetres arrives a
  hundred times too big and fills the screen.
- The **first animation clip** is the pedalling loop, played at a rate driven
  by real cadence. **One clip revolution must be one crank revolution**, or
  the legs will not match the number on the dial.
- Skinned meshes are cloned with their own skeleton per rider, so a bunch does
  not pedal in lockstep.

## 2. The scenery — `props/*.glb`

Anything in `props/` is scattered along both sides of the road: trees, rocks,
barriers, signs, buildings, spectators. The world places them deterministically
from the course id, so the same course always looks the same and two riders on
it see the same world.

- One object per file, **origin at its base**, **facing +Z**, in metres.
- Name the file for what it is — `pine.glb`, `boulder.glb`, `barrier.glb`.
  A number suffix groups variants: `pine-1.glb`, `pine-2.glb`.
- **Under ~5k triangles each.** These are drawn hundreds of times.
- Rotation and spacing are handled for you; do not pre-rotate or pre-scatter.

Run `npm run art` after adding files to rebuild the manifest.

## Licences — read this before using anything you found online

Check the licence on the model's own page, every time:

| | |
|---|---|
| **CC0** | No conditions. Safest. |
| **CC-BY** | Commercial use allowed, but **attribution is required** and must appear somewhere a user can find it. |
| **Editorial / personal use only** | **Cannot ship in this app.** |
| **Paid / royalty-free** | Read what it covers — some exclude apps that are themselves sold or subscribed to. |

FORGE is intended as a commercial product, so a model that is free for a hobby
project is not automatically free for this one. Sketchfab, Poly Pizza and
Quaternius all host good cycling and scenery assets; Sketchfab mixes licences
per model, Poly Pizza is CC0 or CC-BY, Quaternius is CC0.

When a model is CC-BY, add it to `public/models/CREDITS.md` as you add the
file. An attribution nobody wrote down is a licence breach waiting to be found.

## Performance, because a bunch forms fast

A group ride can hold dozens of riders and hundreds of props on screen.

- Rider: **under ~30k triangles**, **one material**.
- Props: **under ~5k triangles** each.
- Textures **1024px or smaller**, and prefer none at all — flat colours read
  better at this scale and cost nothing.
- A 500k-triangle photoscan looks better standing still and drops the frame
  rate through the floor the moment anyone else appears.

## The look this is going for

Stylised, not photoreal. A hand-made photoreal world takes an art team years,
and an approximation of one looks cheap beside the games people already play.
Low-poly with flat colours reads as a decision. Almost-real reads as a budget
problem. Match the app: near-black ground, volt green for anything that
matters, fog swallowing the distance.
