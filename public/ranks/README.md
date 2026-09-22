# Rank artwork

Seven tiers, five sub-ranks each (I–V, two levels per sub-rank), named after
the tier key in `src/lib/gamification.ts` and the sub-rank number:

    public/ranks/iron-1.png … iron-5.png
    copper · bronze · silver · gold · emerald · platine

Then run `npm run art:optimise`: it resizes to 512 px WebP, moves the originals
to `art-source/` (outside `public/`, not shipped) and rebuilds the manifest.
A tier with only `<tier>-1` uses that file for every sub-rank; a tier with no
file keeps the drawn shield.

**Format**

- PNG or WebP, transparent background, square
- Renders from 32 px up to 190 px

The roman numeral is baked into the supplied set. The app draws one over the
shield only when there is no artwork.
