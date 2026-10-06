# PlanetForge

**▶ Open it live: https://friedsalad21.github.io/PlanetForge/**

Procedural space in the browser, built with three.js. Every world comes from a 64-bit seed in the URL, so any world, and any planet or moon in it, can be shared by its link. Zoom out and the star you're at is one of 150,000 in a galaxy, and the galaxy is one of 800 in a universe: every one of them generated from seeds, nothing stored.

- **Galaxies:** spirals with two to five arms, barred spirals, ellipticals and clumpy irregular clouds, from giants to dwarfs (and the odd starburst or faded spiral), drawn as a ray-marched glow with dust lanes, a bright bulge and pink star-forming knots, plus every star as a point of light. Click any star to fly there and warp into its star system. Fly into nebulae (they hold young systems still forming), visit the supermassive black hole at the centre, find globular clusters in the halo. Inside a galaxy, a star system's sky shows the galaxy's band of light from where that star really is.
- **The universe:** 800 galaxies in clusters and filaments, strung on a faint glowing cosmic web. Fly into any of them without a break, and back out again by zooming away. Galaxies you've been to are ringed. **⌂ Random worlds** (W) takes you back out to random worlds of their own.
- **Explore:** click any planet, moon, star, comet or space station to fly to it and orbit it as it moves. Or fly freely with W A S D and the mouse (or the on-screen stick on a phone).
- **Real orbits:** elliptical, tilted Kepler orbits. Inner planets go round faster, binary stars swing round their shared centre of mass, moons always keep one face to their planet, and tilted planets have seasons on their ice caps. You can pause, slow down or fast-forward time.
- **Planets:** 31 types, from Earth-like and ocean worlds to canyons, crystal worlds, tidally locked eyeballs, Venus-like cloud worlds, ice giants and hot Jupiters. Rivers and lakes, volcanoes with lava flows and ash plumes, lightning, waves and sun glint, snow and ice. Crystal worlds come in four looks (prismatic, geode fields, glass seas, ice spires). Clouds have two layers with crisp, wind-eroded edges that shade themselves. Inhabited worlds light up at night with sprawling cities joined by roads, not blobs. The air is ray-marched, so the limb glows blue and the terminator turns orange. Auroras form rings around each world's magnetic poles, which on ice giants can be tipped far from the spin axis.
- **Gas giants:** banded storms that twist into vortices, faint Saturn-style polar hexagons, strings of pearl storms, dark spots and clusters of polar cyclones.
- **Rings and moons:** banded rings with thousands of fine ringlets and gaps, sharp from any angle (and glowing when lit from behind), particles, shepherd moonlets and shadows. Cratered moons, some volcanic, some with rings of their own. Eclipses: moons cast shadows on their planet and the planet shadows its moons.
- **Star systems:** 12 star types, including Wolf-Rayet stars, pulsing Cepheids, protostars in dusty disks and flashing pulsars. Binaries, trinaries and wide binaries, comets with rocky nuclei and dust and ion tails, asteroid belts with real cratered rocks when you fly close, planetary nebulae and supernova remnants.
- **Black holes:** ray-traced. The disk arches over and under the shadow, one side is brightened by Doppler beaming, and the stars behind are lensed into arcs.
- **Rare finds:** rogue planets, Dyson swarms and shells, space stations and drifting wrecks. Rare combinations are marked Uncommon, Rare, Epic or Legendary.
- **Detail at any zoom:** surfaces keep adding finer detail as you zoom in, and far bodies fade to dots.

**Runs smoothly anywhere:** quality drops automatically when the frame rate falls and comes back when there's headroom. Settings are remembered, and the page follows your system's reduced-motion setting.

What's next: see the **[roadmap](ROADMAP.md)** (a gravity simulation toggle, landing on planets, a discovery log and more).

## Controls

| | |
|---|---|
| Click a body | Fly to it and orbit it (in a galaxy: a star or nebula, then warp in; in the universe: a galaxy) |
| Click empty space / Esc | Zoom back out (when zoomed out: a new world; in a galaxy's star system: back to the galaxy) |
| Tab / 1–9 / 0 | Next body / planet number / the star |
| Drag / scroll | Look around / zoom (in galaxies and the universe, scroll zooms towards the pointer and right-drag or Shift-drag pans; scrolling out of a galaxy's star system goes back to the galaxy) |
| Space / → | New world (in a galaxy: a random star; in the universe: a random galaxy) |
| G | Zoom out a level: star system → its galaxy → the universe |
| W | Leave the galaxies: back to random worlds |
| / | Find a star, nebula or galaxy by name, or go to a seed or link |
| ← / browser Back | Previous world |
| P · , . | Pause · slower / faster time |
| O | Show orbits |
| F | Free flight: W A S D move, mouse looks (click to lock), Shift boosts, Q / E roll, R / C up / down, wheel sets speed |
| C | Copy a link to this exact view |
| S | Save a screenshot, up to 4× the screen's resolution |
| H | Hide all the UI (screenshot mode) |
| ? · ⚙ | All controls · settings (quality, frame-rate cap, glow, brightness, motion, text, screenshot size) |

## Links

| | |
|---|---|
| `#123` | the world of seed 123 (a lone planet, star system or black hole), as always |
| `#123-p2m1` | the same, looking at planet 2's first moon |
| `#u1` | the universe |
| `#g0` | a galaxy (galaxy 0 is home, the Forge) |
| `#g0.s1234` | the star system of star 1234 in galaxy 0 (add `-p1` etc. for a body in it) |
| `#g0.n3` | the young system inside nebula 3 |
| `#g0.s0` | the supermassive black hole at the centre |

## Wallpaper Engine

The repo doubles as a Wallpaper Engine web wallpaper. In Wallpaper Engine, choose **Open Wallpaper → Open from File** and pick `project.json`. Its settings panel controls how often the world changes, which kinds of objects appear (including galaxies, which it drifts through and now and then dives into), a fixed seed or link, the tour from body to body, orbit lines, glow, automatic quality, zoom, position, camera angle and drift, mouse parallax, animation speed, brightness and colour, text, render quality and the FPS limit. three.js is bundled in `lib/`, so it works offline.

## Code

`index.html` is just the page; the code is in `src/` as ES modules. Notes for making changes (keeping docs up to date, seed stability, shader pitfalls) are in [`CLAUDE.md`](CLAUDE.md); what's done and what's next is in the [roadmap](ROADMAP.md).

The code is in `src/` as ES modules:

| | |
|---|---|
| `main.js` | wires everything together and runs the frame loop |
| `scene.js` | renderer, cameras, the backdrop, bloom |
| `materials.js` | every shader: surfaces, clouds, atmosphere, auroras, rings, stars, nebulae, comets, the black hole |
| `shaders.js` | shared GLSL: noise, ring bands, cloud cover, eclipses, volcanoes |
| `gen.js` | seeds, world kinds, star types, names |
| `world.js` | one complete planet with its rings, moons and features |
| `system.js` | builds a seed into a lone planet, a star system or a black hole; moves and lights it |
| `extras.js` | comets, belts, stations, Dyson swarms, nebula shells, pulsars |
| `orbit.js` | Kepler orbits and orbit lines |
| `camera.js` | focus, fly-to, free flight, the wallpaper tour, floating origin |
| `ui.js` | toolbar, keys, mouse and touch, links |
| `nav.js` | moving between the universe, a galaxy and a star system: links, flights, the warp, the galaxy's band in a system's sky |
| `galaxymodel.js` | a galaxy's shape from its seed, its stars, clusters and nebulae, their names and seeds |
| `galaxyshaders.js` | galaxy glow, star points, far-away galaxies, nebula volumes, the warp |
| `galaxy.js` · `universe.js` | the galaxy view and the universe view, with picking |
| `search.js` | Find: names, seeds and links |
| `settings.js` · `perf.js` | display and motion settings (shared by the website and the wallpaper) · automatic quality |
| `warmup.js` | compiles the shaders other worlds need in the background |
| `wallpaper.js` | Wallpaper Engine settings |

Seeds stay stable: everything added after the original generator draws from a second random stream, so old links still show the same worlds, apart from the few that rolled one of the rare new finds. The galaxy model's noise uses integer hashing that gives the same numbers in JavaScript and in the shaders, so the stars sit in the arms the glow shows. Type `PF` in the browser console to poke at the current world.
