# PlanetForge

**▶ Open it live: https://friedsalad21.github.io/PlanetForge/**

Procedural space in the browser, built with three.js. Every world comes from a 64-bit seed in the URL, so any world, and any planet or moon in it, can be shared by its link.

- **Explore:** click any planet, moon, star, comet or space station to fly to it and orbit it as it moves. Or fly freely with W A S D and the mouse (or the on-screen stick on a phone).
- **Real orbits:** elliptical, tilted Kepler orbits. Inner planets go round faster, binary stars swing round their shared centre of mass, moons always keep one face to their planet, and tilted planets have seasons on their ice caps. You can pause, slow down or fast-forward time.
- **Planets:** 31 types, from Earth-like and ocean worlds to canyons, crystal worlds, tidally locked eyeballs, Venus-like cloud worlds, ice giants and hot Jupiters. Rivers and lakes, volcanoes with lava flows and ash plumes, auroras, lightning, two cloud layers, waves and sun glint, snow and ice, night-side cities. The air is ray-marched, so the limb glows blue and the terminator turns orange.
- **Gas giants:** banded storms that twist into vortices, Saturn-style polar hexagons, strings of pearl storms, dark spots and clusters of polar cyclones.
- **Rings and moons:** banded rings with gaps, particles, shepherd moonlets and shadows. Cratered moons, some volcanic, some with rings of their own. Eclipses: moons cast shadows on their planet and the planet shadows its moons.
- **Star systems:** 12 star types, including Wolf-Rayet stars, pulsing Cepheids, protostars in dusty disks and flashing pulsars. Binaries, trinaries and wide binaries, comets with dust and ion tails, asteroid belts, planetary nebulae and supernova remnants.
- **Black holes:** ray-traced. The disk arches over and under the shadow, one side is brightened by Doppler beaming, and the stars behind are lensed into arcs.
- **Rare finds:** rogue planets, Dyson swarms and shells, space stations and drifting wrecks. Rare combinations are marked Uncommon, Rare, Epic or Legendary.
- **Detail at any zoom:** surfaces keep adding finer detail as you zoom in, and far bodies fade to dots.

What's next: see the **[roadmap](ROADMAP.md)** (a gravity simulation toggle, galaxies and a whole universe, landing on planets and more).

## Controls

| | |
|---|---|
| Click a body | Fly to it and orbit it |
| Click empty space / Esc | Zoom back out (when zoomed out: a new world) |
| Tab / 1–9 / 0 | Next body / planet number / the star |
| Drag / scroll | Look around / zoom |
| Space / → | New world |
| ← / browser Back | Previous world |
| P · , . | Pause · slower / faster time |
| O | Show orbits |
| F | Free flight: W A S D move, mouse looks (click to lock), Shift boosts, Q / E roll, R / C up / down, wheel sets speed |
| C | Copy a link to this exact view |
| S | Save a screenshot |
| H | Hide the text |
| ? | All controls |

## Wallpaper Engine

The repo doubles as a Wallpaper Engine web wallpaper. In Wallpaper Engine, choose **Open Wallpaper → Open from File** and pick `project.json`. Its settings panel controls how often the world changes, which kinds of objects appear, the tour from body to body, orbit lines, glow, zoom, position, camera angle and drift, mouse parallax, animation speed, brightness and colour, text, render quality and the FPS limit. three.js is bundled in `lib/`, so it works offline.

## Code

`index.html` is just the page; the code is in `src/` as ES modules:

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
| `wallpaper.js` | Wallpaper Engine settings |

Seeds stay stable: everything added after the original generator draws from a second random stream, so old links still show the same worlds, apart from the few that rolled one of the rare new finds. Type `PF` in the browser console to poke at the current world.
