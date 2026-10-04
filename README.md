# PlanetForge

**▶ Open it live: https://friedsalad21.github.io/PlanetForge/**

Procedural space in the browser, built with three.js. Every world comes from a 64-bit seed in the URL, so any world can be shared by its link.

- **Planets:** 31 types, from Earth-like and ocean worlds to canyons, crystal worlds, tidally locked eyeballs, Venus-like cloud worlds, ice giants and hot Jupiters. Waves, sun glint, cloud and ring shadows, snow and ice, and night-side city lights.
- **Rings and moons:** banded rings with gaps and particles, and cratered rocky, icy, sulphur, rusty and dark moons.
- **Star systems:** 9 star types, including binary stars, neutron stars and asteroid belts. Every orbiting planet is a full world of its own, with its own surface, clouds, atmosphere, rings and moons.
- **Black holes:** swirling accretion disks of different colours.
- **Detail at any zoom:** the surfaces are drawn from layered noise that keeps adding finer detail as you zoom in.

What's next: see the **[roadmap](ROADMAP.md)** (free movement, real orbits, a gravity simulation toggle, galaxies and a whole universe, landing on planets and more).

## Controls

| | |
|---|---|
| Click / Space / → | New world |
| ← / browser Back | Previous world |
| Drag / scroll | Spin / zoom |
| C | Copy a link to this world |
| S | Save a screenshot |
| H | Hide the text |

## Wallpaper Engine

The repo doubles as a Wallpaper Engine web wallpaper. In Wallpaper Engine, choose **Open Wallpaper → Open from File** and pick `project.json`. Its settings panel controls how often the world changes, which kinds of objects appear, zoom, position, camera angle and drift, mouse parallax, animation speed, brightness and colour, text, render quality and the FPS limit. three.js is bundled in `lib/`, so it works offline.
