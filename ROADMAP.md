# PlanetForge roadmap

Ideas and planned features, roughly in the order they make sense to build. Tick items off (`- [x]`) as they ship.
The long-term goal is a **No Man's Sky-style explorable universe**: everything generated from seeds, nothing stored, endless to explore.

## How it fits together

```
universe seed ─▶ galaxies ─▶ star systems ─▶ planets ─▶ moons
                                  │              │
                         build(seed) today   makeWorld() today
```

Each level gets its own seed and is only generated when you get close, so the universe can be effectively infinite.

---

## 1. Free movement (do first: everything else builds on it)

- [ ] Click any planet, moon or star to fly smoothly to it and orbit around it
- [ ] Free-fly mode: WASD + mouse look, Shift to boost, Q/E to roll
- [ ] Smooth camera transitions (ease in and out, no jumps)
- [ ] "Return to system view" button / key
- [ ] Floating origin: keep the camera near (0,0,0) and move the world instead, so there's no jitter at huge distances
- [ ] Level of detail by distance: full planet → simple sphere → dot → nothing
- [ ] Touch controls for free-fly on phones (virtual stick)
- [ ] Wallpaper mode: a slow cinematic tour that drifts from body to body

## 2. Real orbits (Kepler "on-rails")

- [ ] Elliptical orbits with eccentricity, inclination and a random starting angle
- [ ] Speeds from Kepler's laws (inner planets fast, outer slow)
- [ ] Moons orbit their planet while it orbits the star (already nested; make it Kepler-correct)
- [ ] Binary stars orbit their shared centre of mass on ellipses
- [ ] Optional orbit lines (faint ellipses) with a toggle
- [ ] Tidally locked worlds really face their star as they orbit
- [ ] Day length and axial tilt per planet; seasons visible on the ice caps
- [ ] Time controls: pause, slow motion, fast-forward

## 3. Real gravity simulation (toggle)

- [ ] Toggle between on-rails orbits and a real n-body simulation
- [ ] Start from the on-rails positions with matching orbital velocities, then let gravity take over
- [ ] Stable integrator (leapfrog / velocity Verlet); masses from body size and type
- [ ] Collisions: flash, then the bodies merge
- [ ] Ejections: bodies flung out of the system
- [ ] Orbit trails that show paths drifting and tangling
- [ ] Time-speed slider to watch thousands of years of chaos
- [ ] Reset button that snaps back to the seed's orbits
- [ ] Stretch: throw in a rogue planet or star and watch what happens

## 4. Galaxy and universe

- [ ] Galaxy view: spiral arms (and elliptical / irregular galaxies) made of thousands of stars as points of light
- [ ] Each star has a seed and expands into a full star system when you fly to it
- [ ] Star colours and densities follow the galaxy's structure (blue arms, older yellow/red core)
- [ ] Nebulae as real places you can fly into, not just a backdrop
- [ ] Black hole at the galactic centre
- [ ] Universe view: many galaxies scattered through space, fly between them
- [ ] Galaxy map with search by seed and "jump to random star"
- [ ] Shareable links that point to any place: universe / galaxy / system / planet
- [ ] Warp / hyperspace transition effect when jumping between stars

## 5. More to discover

- [ ] More star types: Wolf-Rayet, variable/pulsing stars, protostars in nebulae
- [ ] Neutron star / pulsar visuals done properly (subtle, not the old beams)
- [ ] Trinary and wide-binary systems; circumbinary planets
- [ ] Rogue planets drifting between stars
- [ ] Comets with tails that point away from the star
- [ ] Planetary nebulae and supernova remnants
- [ ] Dyson spheres / megastructures as rare finds
- [ ] Space stations and derelicts as very rare finds
- [ ] Rings on more objects (moons with rings, ringed ice giants with tilted rings)
- [ ] Shepherd moons inside ring gaps
- [ ] Rarity tiers so some finds feel special ("1 in 10,000 worlds")

## 6. Planet visuals

- [ ] Rivers and lakes that follow the terrain
- [ ] Volcano glow and ash plumes on volcanic worlds
- [ ] Auroras near the poles on the night side
- [ ] Lightning flashes inside storm clouds
- [ ] Moon shadows on planets (eclipses) and planet shadows on moons
- [ ] Atmosphere scattering done properly (blue limb, orange sunset band at the terminator)
- [ ] Bloom / glow post-processing for stars, lava and city lights
- [ ] Cloud layers with depth (two layers, parallax)
- [ ] Gas giants with polar hexagons and more storm types
- [ ] Better black holes: gravitational lensing of the background stars

## 7. Spaceship and landing (the big ones)

- [ ] A spaceship to pilot (third-person view, thrust and boost)
- [ ] Approach a planet seamlessly: orbit view → atmosphere entry → ground
- [ ] Ground-level terrain generated from the same height function as the orbit view
- [ ] Walk around on the surface: sky colour, sun, clouds overhead, other planets and moons in the sky
- [ ] Simple flora and rocks scattered by biome
- [ ] Water you can see from the shore
- [ ] Day/night cycle on the surface

## 8. Discovery and progress

- [ ] Discovery log: every system, planet and moon you visit, with screenshots
- [ ] Name your discoveries (stored locally)
- [ ] Favourites / bookmarks of seeds
- [ ] Planet data card: size, gravity, temperature, day length, atmosphere, "habitability" (generated from the seed)
- [ ] Achievements: first ringed world, first black hole, 100 systems visited…
- [ ] Shared discoveries: other people's named worlds (needs a small backend)

## 9. Sound

- [ ] Ambient space music that changes with what you're looking at
- [ ] Soft sounds for travel, warp and discovery
- [ ] Wallpaper Engine audio-reactive mode (planets and stars pulse with music)

## 10. Quality of life

- [ ] Settings panel on the website (quality, FPS cap, text, motion, same as the wallpaper)
- [ ] Performance auto-scaling (drop render quality when the frame rate falls)
- [ ] Screenshot mode: hide all UI, higher-resolution export
- [ ] Wallpaper thumbnail image (`preview.jpg`) for Wallpaper Engine
- [ ] Faster first load: compile shaders in the background while showing the loading screen
- [ ] Accessibility: reduced-motion option, keyboard focus styles, screen-reader text for the current world

---

## Done

- [x] Procedural planets from 64-bit seeds: 31 types, terrain, oceans with waves, snow and ice, clouds, atmosphere, city lights
- [x] Detail at any zoom (level-of-detail noise)
- [x] Rings with gaps, particles, and shadows on the planet; cloud shadows
- [x] Cratered moons; star systems with 9 star types, binaries and asteroid belts; black holes with accretion disks
- [x] Every planet in a star system is a full world with its own clouds, rings and moons
- [x] Toolbar: back / new / copy link / screenshot / hide text; browser history; keyboard shortcuts
- [x] Wallpaper Engine support with 20 settings, bundled three.js for offline use
