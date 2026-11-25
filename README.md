# Gully Guessr

A polished, single-player, India-only street geography guessing game. No login, no accounts, no backend — open the page and play. Personal bests, settings, and recent matches are stored locally in `localStorage`.

## Features

- **5-round matches across India** — procedurally sampled across all 28 States and 8 Union Territories with balanced population weighting so smaller and Himalayan/Northeast states appear regularly.
- **Region packs** — play **All India** or focus on **North**, **South**, **West**, **East**, or **Metro** packs.
- **Multiple rulesets & timers** — Standard, No Move, and NMPZ (`No Move, Pan, Zoom`), untimed or `60s` / `90s` / `120s` per round.
- **Zero-key Open Mode by default** — works out of the box using Wikimedia Commons street photography and a verified local pool of 47 images, with optional upgrades to **Mapillary 360°** or **Google Street View**.
- **Regional clues on reveal** — inspect distance off, score, reverse-geocoded locality, and state/UT clues (scripts, RTO plate prefixes, landscape tells, and visual hints).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

To rename the title in one place, edit `GAME_TITLE` in [`src/config.ts`](src/config.ts) (and `<title>` in [`index.html`](index.html)).

## Imagery providers

| Tier | Enable with | What you get |
| --- | --- | --- |
| 1 · Google Street View | `VITE_GOOGLE_MAPS_API_KEY` | Live outdoor Street View with road labels/addresses hidden; Standard / No Move / NMPZ rulesets |
| 2 · Mapillary 360° | `VITE_MAPILLARY_ACCESS_TOKEN` | Free crowd-sourced equirectangular panoramas (Photo Sphere Viewer) with sequence stepping |
| 3 · Open Mode (default) | *(none required)* | Wikimedia Commons street photography matched to the procedural coordinate, plus a verified local pool of 47 images |

Copy [`.env.example`](.env.example) to `.env` and fill in a key to upgrade. Providers degrade gracefully (`Google → Mapillary → Open`), and every round falls back to the verified pool if live imagery is unavailable.

## How a round is generated

1. **Archetype roll** (`src/engine/locationGenerator.ts`): urban town 45% · highway corridor 28.5% · rural settlement 18% · coast/hills/heritage 7% · forest road 1.5%.
2. **Balanced state pick**: square-root-dampened population weights with a floor, so the Northeast, Himalaya, and small states appear regularly. Region packs filter the anchor atlas first.
3. **Jitter + boundary guard**: uniform polar jitter (`r = R·√u`) around one of ~470 anchors (`src/data/indiaAnchors.ts`), validated against a simplified India-POV Natural Earth landmass (`src/data/indiaBoundary.ts`). Rounds in a game stay ≥ 35 km apart; recently used anchors are avoided across sessions.
4. **Snap & verify** (`src/engine/roundPlanner.ts`): up to 8 candidates in concurrent batches of 2. The provider snaps them to imagery; `identifiabilityFilter.ts` rejects forest-only spots via Overpass (1.5 s timeout, circuit breaker, graceful fallback) and dark/blank images. The next round is prefetched while you play.
5. **Reveal**: reverse geocoding (Google or Nominatim at ≤ 1 req/s, falling back to anchor metadata) plus per-state clues (`src/data/indiaStateClues.ts`: scripts, RTO prefix, landscape, and look-for hints for all 28 States + 8 UTs).

## Scoring

Haversine distance `d` (km): `5000` if `d ≤ 0.15`, otherwise `round(5000 · e^(−d/650))`, clamped to `[0, 5000]`. Five rounds per game, `25,000` max score.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Lock in guess / next round |
| `Enter` | Next round |
| `M` | Expand or collapse map |
| `Esc` | Collapse expanded map |
| `R` | Reset view |
| `+` / `−` | Zoom view |

## Scripts

```bash
npm test           # Vitest: scoring, Monte Carlo archetype distribution, boundary, packs, separation, filters
npm run build      # Type-check + production build
npm run preview    # Preview production build locally
npm run typecheck  # TypeScript check
```

## Tech stack

- React 19 + TypeScript + Vite
- Leaflet & `react-leaflet` for the interactive guess & reveal maps
- `@photo-sphere-viewer/core` & Three.js for 360° Mapillary panoramas
- Vitest for unit & Monte Carlo distribution tests

## Attribution

Map tiles © Esri; map data © OpenStreetMap contributors; geocoding by Nominatim; land checks via Overpass API; boundary from Natural Earth (public domain). Street photographs come from Wikimedia Commons and are credited on each reveal. Hero photo: “Jaipur – Hawa Mahal bazaar view” by Daniel Villafruela, CC BY-SA 3.0.
