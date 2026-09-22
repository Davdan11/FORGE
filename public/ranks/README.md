# Rank artwork

One file per tier, named after its key in `src/lib/gamification.ts`:

    public/ranks/iron.png    bronze.png    silver.png    gold.png
    public/ranks/platinum.png    diamond.png    forge.png

Then run `npm run art`. Missing tiers keep the drawn shield.

**Format**

- PNG or WebP, transparent background
- 512×564 (the shield is taller than it is wide, 1:1.1)
- Renders from 56 px up to 150 px

The roman sub-rank (I–IV) is drawn by the app over the shield only when no
artwork is supplied, so bake it in or leave it off as you prefer.
