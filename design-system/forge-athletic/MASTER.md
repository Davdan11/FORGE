# Design System Master File — FORGE

> **LOGIC:** When building a specific page, first check `design-system/forge-athletic/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file. If not, strictly follow the rules below.

---

**Project:** Forge — the complete training app
**Revised:** 2026-09-21 (v3 — produit **gratuit, mondial, sans coach humain** ; site en anglais)
**Category:** Fitness app premium, free-to-use
**Design Dials:** Variance 8/10 (bold, éditorial) | Motion 9/10 (chorégraphié) | Density 4/10 (aéré)

## Périmètre produit (v3)

- 100 % gratuit, aucun palier, aucune carte. Pas de section tarifs : « Free. All of it. »
- Mondial dès le jour 1 : anglais par défaut, 14 langues, kg/lb, fuseaux, offline. Aucune ville « maison » — ticker de villes mondiales.
- **Pas de coach humain** : l'autorégulation est faite par « the engine » (sommeil, HRV, RPE, contraintes).
- Socle : bibliothèque 1 200+ exercices (3D 360° + vidéo + cues), journal de séance, cardio + GPS façon Strava (carte, tracé, splits, dénivelé), nutrition adaptative avec notifications, communauté, gamification (niveaux, XP, badges, crews).
- Différenciateurs : moteur 5 piliers, autorégulation en séance, périodisation annuelle, technique, mode vie réelle, le « pourquoi ».

## Blocs UI (mocks produit sur la landing)

Composant `.ui` : fond carbon, filet 1 px, rayon 6 px, ombre profonde. Contenu réaliste, chiffres tabulaires, un seul accent volt par bloc.
`.ui--lib` (photo + badge 3D + dial 360° + onglets d'angle) · `.ui--log` (séries, RPE, « Why this? ») · `.ui--map` (SVG contours + tracé dégradé dessiné au scroll + splits + dénivelé) · `.ui--food` (photo + repas + toasts cycliques) · `.ui--game` (anneau de niveau + XP + badges + crew) · `.ui--life` (chips + planned → rewritten).

---

## Direction artistique

Cinématique, éditorial, sobre. Le site doit ressembler à une campagne de marque sportive haut de gamme, pas à un template SaaS.

- **Photographie réelle, plein écran, sombre** (Unsplash, désaturée à 70–85 %, voile noir en dégradé). Jamais d'illustration vectorielle, de mascotte, de grille décorative ni de scanlines.
- **Une seule couleur d'accent** (volt) utilisée avec parcimonie : mot en italique, pastille live, CTA principal, bordure du plan mis en avant.
- **Grain** fixe très léger (opacité ≈ 0.05) sur toute la page.
- **Lignes fines** (`--line`) plutôt que des cartes à ombre ; angles à 4 px max.
- **Grande échelle typographique** : titres à 6–12 vw, interlignage 0.9.

## Couleurs

| Rôle | Hex | Variable |
|------|-----|----------|
| Fond | `#0A0A0A` | `--ink` |
| Surface | `#121212` | `--carbon` |
| Surface 2 | `#1B1B1B` | `--graphite` |
| Texte | `#ECE7DF` | `--bone` |
| Texte atténué | `#8F8A82` | `--smoke` |
| Accent | `#D4FF3A` | `--volt` |
| Filet | `rgba(236,231,223,.14)` | `--line` |
| Filet fort | `rgba(236,231,223,.32)` | `--line-strong` |

Contrastes : bone/ink 16:1 · smoke/ink 5.6:1 · volt/ink 17:1 · ink/volt 17:1.

## Typographie

- **Titres :** Archivo, `font-stretch: 125%`, 800, capitales, `letter-spacing: -.025em`, `line-height: .9`.
- **Accent éditorial :** Instrument Serif italique 400, en bas de casse, couleur volt, `font-size: 1.12em`, un seul mot ou groupe par titre.
- **Corps :** Archivo 400, 17 px, `line-height: 1.55`.
- **Méta :** 12.5 px, 500, capitales, `letter-spacing: .12em`, couleur smoke, numéro de section en `<sup>` volt.

```css
@import url('https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900;1,62..125,100..900&family=Instrument+Serif:ital@0;1&display=swap');
```

## Espacement

`--gutter: clamp(20px, 4vw, 56px)` · conteneur `1440px` · sections `clamp(80px, 12vh, 160px)` · sections plein écran `100svh`.

## Composants

- **Pill** : 48 px de haut (60 px en `--lg`), rayon 999, 1 px de bordure. Variantes `bone` (fond os), `volt` (fond accent), `line` (contour). Flèche 18 px qui glisse de 4 px au survol. Effet magnétique (`data-magnetic`) sur 1–2 CTA par écran max.
- **Lien** : soulignement 1 px qui se rétracte à 30 % au survol.
- **Ligne de liste** (piliers) : filet haut/bas, numéro · nom expanded · description smoke · flèche ronde 44 px. Au survol : nom en volt +10 px, flèche pleine volt tournée à 45°, image fantôme 320 px qui suit le curseur.
- **Plan tarifaire** : filet haut (2 px volt pour le plan principal), prix expanded 3–4.6 rem, liste à puces volt de 6 px.

## Motion (GSAP 3.12 + ScrollTrigger + Lenis)

| Élément | Effet | Durée / ease |
|---------|-------|--------------|
| Loader | lettres masquées + compteur 00→100, rideau `yPercent:-100` | 0.9 s / 0.95 s `expo.inOut` |
| Hero | image `scale 1.18→1`, lignes masquées, fondus | 2.2 s / 1.2 s `expo.out` |
| Hero au scroll | parallaxe image `yPercent 16`, contenu qui s'estompe | scrub |
| Titres | lignes `translateY(110%)→0`, stagger .09 | 1.1 s `expo.out` |
| Images | `clip-path: inset(100% 0 0 0)→0` + `scale 1.16→1` | 1.5 s `expo.out` |
| Paragraphes | opacité mot à mot liée au scroll (.16→1) | scrub .6 |
| Bandeau | deux jeux identiques, `xPercent:-50` en boucle, ralenti au survol | 28 s linéaire |
| Méthode | image épinglée qui change (`.is-on`), étape active à 100 %, autres à 32 % | 700 ms |
| Coachs | section épinglée, défilement horizontal scrub ; ≤ 860 px : scroll natif + snap | scrub .8 |
| Fonds | parallaxe `yPercent ±10–12` | scrub |
| Compteurs | `power3.out`, format fr-FR | 1.8 s |

`prefers-reduced-motion` : loader retiré, tout à l'état final, Lenis désactivé, grain immobile.

## Anti-patterns (à ne jamais réintroduire)

- ❌ Grille / lignes décoratives en fond, scanlines, orbes floues
- ❌ Illustrations vectorielles de personnages, icônes « jouet »
- ❌ Palettes multi-accents (orange + vert + …)
- ❌ Cartes flottantes qui rebondissent, révélations caractère par caractère avec `rotateX`
- ❌ Coins arrondis > 4 px sur les surfaces, ombres portées visibles
- ❌ Emojis comme icônes, `cursor: pointer` manquant, focus invisible

## Checklist avant livraison

- [ ] Photos réelles partout, désaturées, voile noir cohérent
- [ ] Un seul accent volt ; jamais deux couleurs vives sur un même écran
- [ ] Titres : capitales expanded + un mot serif italique volt
- [ ] Toutes les révélations respectent `prefers-reduced-motion`
- [ ] Focus visible (2 px volt, offset 5 px)
- [ ] Responsive : 375 / 768 / 1024 / 1440, aucun scroll horizontal
- [ ] Coachs : pin uniquement ≥ 861 px
