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

## To review (only when asked: Sean is still testing these)

- [ ] Pulsar beams: remove completely, including the flash as the beam sweeps past
- [ ] Black hole camera limit: zooming out stops at 40 units because the bent-light (lensing) effect is only drawn inside a sphere 50 units across; make it work at any distance and remove the limit
- [ ] Black hole warping (the stars around it stretched into arcs): remove completely

---

## Next up: phase 4 plan (galaxy and universe)

Phase 4 is the big step towards the No Man's Sky goal: today every seed is one isolated system; after it, every system is a real star in a galaxy you can fly through. It's split into milestones that each ship on their own, so the site keeps working after every push.

**Ground rules**
- Old links keep working: `#123` still opens the same system as today. New links get a prefix (see 4e).
- Nothing is stored: every galaxy, sector and star is rebuilt from seeds as you approach it.
- Three scales, never mixed in one scene: universe (galaxies), galaxy (stars as points), system (what we have now). Switching scale is a crossfade + camera hand-off, and the floating origin from phase 1 keeps each one jitter-free.

**4a. One galaxy you can look at** (new `src/galaxy.js`)
- [ ] Galaxy shape from a seed: spiral (2 to 6 log-spiral arms, bar or no bar), elliptical, irregular
- [ ] Density function: bright bulge + exponential disk + arms, with dark dust lanes along the inner edge of each arm
- [ ] Draw it as ~200,000 GPU points (one draw call, size and colour per star) plus a soft glow layer, so it looks right from far away
- [ ] Colours follow the structure: young blue/white stars and pink star-forming knots in the arms, older yellow/red core
- [ ] Galaxy view: orbit it like a planet, with bloom on the core

**4b. Every star is a system**
- [ ] Split the galaxy into a 3D grid of sectors; each sector's stars come from `hash(galaxy seed, sector)`, generated only near the camera
- [ ] Each star gets a type that fits where it is (more red dwarfs everywhere, blue giants in the arms, exotic stars rare) and its own system seed
- [ ] `build(seed, {star})`: the system generator accepts the star type the galaxy chose, so the star you clicked is the star you arrive at
- [ ] Hover a star: name, type, distance; click: fly to it, and as you arrive the point becomes the real system (crossfade)
- [ ] "Zoom out" from a system goes back up to the galaxy, at that star

**4c. Landmarks**
- [ ] Supermassive black hole at the centre (reuses the black hole system, scaled up)
- [ ] Nebulae as places: soft ray-marched clouds in the arms that you can fly into, with protostars inside
- [ ] Star clusters (open clusters in the arms, globular clusters in the halo)
- [ ] Rare systems (Dyson spheres, stations, rogues) tend to show up in the right neighbourhoods

**4d. Travel**
- [ ] Warp / hyperspace effect when jumping between stars (stars stretch into streaks, short flash on arrival)
- [ ] Free-fly works in galaxy view too, with speed scaled to the zoom
- [ ] Wallpaper tour: drift through the galaxy, dip into a system now and then

**4e. Map, search and links**
- [ ] Galaxy map overlay: your position, visited stars, "jump to random star"
- [ ] Links to any place: `#g<galaxy>` (galaxy), `#g<galaxy>.<star>` (system), `#g<galaxy>.<star>-p2m1` (moon); plain `#123` stays a standalone system
- [ ] Search by seed or star name

**4f. The universe**
- [ ] Universe seed → galaxies scattered in clusters and filaments; far ones are small images (impostors), near ones become full galaxies
- [ ] Fly between galaxies with a longer warp

**Performance budget:** galaxy view must hold 60 fps on the same machines as today (one draw call for the far stars, sector generation spread over several frames, no shader compile stalls: add the new shaders to the warm-up). Auto quality scales the star count.

**Open questions for Sean** (sensible defaults chosen if not answered): should the website open in galaxy view or keep opening on a random system (default: random system, with a "Galaxy" button)? Should the wallpaper show galaxies (default: yes, as a new allowed kind)?

---

## 1. Free movement (do first: everything else builds on it)

- [x] Click any planet, moon or star to fly smoothly to it and orbit around it
- [x] Free-fly mode: WASD + mouse look, Shift to boost, Q/E to roll
- [x] Smooth camera transitions (ease in and out, no jumps)
- [x] "Return to system view" button / key
- [x] Floating origin: keep the camera near (0,0,0) and move the world instead, so there's no jitter at huge distances
- [x] Level of detail by distance: full planet → simple sphere → dot → nothing
- [x] Touch controls for free-fly on phones (virtual stick)
- [x] Wallpaper mode: a slow cinematic tour that drifts from body to body

## 2. Real orbits (Kepler "on-rails")

- [x] Elliptical orbits with eccentricity, inclination and a random starting angle
- [x] Speeds from Kepler's laws (inner planets fast, outer slow; star masses are compressed so systems stay watchable)
- [x] Moons orbit their planet while it orbits the star (already nested; make it Kepler-correct)
- [x] Binary stars orbit their shared centre of mass on ellipses
- [x] Optional orbit lines (faint ellipses) with a toggle
- [x] Tidally locked worlds really face their star as they orbit
- [x] Day length and axial tilt per planet; seasons visible on the ice caps (in star systems: a lone planet's sun doesn't move)
- [x] Time controls: pause, slow motion, fast-forward

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

- [x] More star types: Wolf-Rayet, variable/pulsing stars, protostars in nebulae
- [x] Neutron star / pulsar visuals done properly (subtle, not the old beams)
- [x] Trinary and wide-binary systems; circumbinary planets
- [x] Rogue planets drifting between stars (lit only by starlight and their own heat)
- [x] Comets with tails that point away from the star
- [x] Planetary nebulae and supernova remnants
- [x] Dyson spheres / megastructures as rare finds
- [x] Space stations and derelicts as very rare finds
- [x] Rings on more objects (moons with rings, ringed ice giants with tilted rings)
- [x] Shepherd moons inside ring gaps
- [x] Rarity tiers so some finds feel special ("1 in 10,000 worlds")

## 6. Planet visuals

- [x] Rivers and lakes that follow the terrain (they wind through the wet lowlands and thin out uphill; not a real flow simulation yet)
- [x] Volcano glow and ash plumes on volcanic worlds
- [x] Auroras near the poles on the night side
- [x] Lightning flashes inside storm clouds
- [x] Moon shadows on planets (eclipses) and planet shadows on moons
- [x] Atmosphere scattering done properly (blue limb, orange sunset band at the terminator)
- [x] Bloom / glow post-processing for stars, lava and city lights
- [x] Cloud layers with depth (two layers, parallax)
- [x] Gas giants with polar hexagons and more storm types
- [x] Better black holes: gravitational lensing of the background stars

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

- [x] Settings panel on the website (quality, FPS cap, text, motion, same as the wallpaper)
- [x] Performance auto-scaling (drop render quality when the frame rate falls)
- [x] Screenshot mode: hide all UI, higher-resolution export
- [x] Wallpaper thumbnail image (`preview.jpg`) for Wallpaper Engine
- [x] Faster first load: compile shaders in the background while showing the loading screen
- [x] Accessibility: reduced-motion option, keyboard focus styles, screen-reader text for the current world

---

## Done

- [x] Procedural planets from 64-bit seeds: 31 types, terrain, oceans with waves, snow and ice, clouds, atmosphere, city lights
- [x] Detail at any zoom (level-of-detail noise)
- [x] Rings with gaps, particles, and shadows on the planet; cloud shadows
- [x] Cratered moons; star systems with 9 star types, binaries and asteroid belts; black holes with accretion disks
- [x] Every planet in a star system is a full world with its own clouds, rings and moons
- [x] Toolbar: back / new / copy link / screenshot / hide text; browser history; keyboard shortcuts
- [x] Wallpaper Engine support with 25 settings, bundled three.js for offline use
- [x] Code split into ES modules (`src/`)
- [x] Phase 1 free movement, phase 2 Kepler orbits, phase 5 rare finds, phase 6 planet visuals and phase 10 quality of life (above)
- [x] Fixed black flickering (NaN pixels from a few shaders, plus a clean-up pass before the bloom)
- [x] Visual polish from testing: cities as connected sprawl with roads, crisp self-shadowing clouds, fine ring detail that stays sharp from below, real cratered asteroids and comet nuclei, four kinds of crystal world, faint polar hexagons, auroral rings around tipped magnetic poles
