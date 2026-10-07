# PlanetForge roadmap

Ideas and planned features, roughly in the order they make sense to build. Tick items off (`- [x]`) as they ship.
This file and the README are updated with every change (see `CLAUDE.md`). **Last updated: 7 October 2026** (variants: about 60 new looks for planets, moons, stars, systems and galaxies; see [VARIANTS.md](VARIANTS.md)).
The long-term goal is a **No Man's Sky-style explorable universe**: everything generated from seeds, nothing stored, endless to explore.

## How it fits together

```
universe seed ─▶ galaxies ─▶ star systems ─▶ planets ─▶ moons
      │              │             │            │
 universe.js  galaxymodel.js  build(seed)  makeWorld()
```

Each level gets its own seed and is only generated when you get close, so the universe can be effectively infinite.
Today: universe seed → 800 galaxies → 60,000–150,000 stars each → a full star system per star (see phase 4).

---

## To review (only when asked: Sean is still testing these)

- [ ] Pulsar beams: remove completely, including the flash as the beam sweeps past
- [ ] Black hole camera limit: zooming out stops at 40 units because the bent-light (lensing) effect is only drawn inside a sphere 50 units across; make it work at any distance and remove the limit
- [ ] Black hole warping (the stars around it stretched into arcs): remove completely

---

## 11. Runs on anything (planned: ideas, not started)

Goal: smooth and sharp on an old phone or a laptop with integrated graphics, not just on a gaming PC. Today the automatic quality only lowers the resolution, which is why weak devices get blurry and still lag: the cost is in the shaders, so that's what has to scale. Ideas, roughly in order of payoff:

- [ ] **Bake planet surfaces into textures:** when you arrive at a planet, draw its surface (and clouds) once into a texture, then each frame just look it up. The expensive terrain maths runs once per planet instead of for every pixel of every frame; detail is re-baked for the patch you're looking at when you zoom in. This is how most games do it, and it's the biggest win.
- [ ] **Quality tiers instead of only resolution:** Low / Medium / High / Ultra presets that switch what's drawn: fewer noise layers, one cloud layer, a simpler atmosphere and rings, fewer ray-march steps for black holes, nebulae and galaxies, no lightning or ring particles on Low. Resolution only drops once the cheaper shaders aren't enough.
- [ ] **Detect the device on first load:** read the GPU name (integrated Intel/AMD, Mali, older Adreno, software rendering) and run a two-second benchmark, then start on the right tier; remember it per device, and let the settings panel override it.
- [ ] **Sharp at lower resolution:** a sharpening upscale pass (like AMD's FSR 1) so rendering at 60% still looks crisp; text and UI stay at full resolution.
- [ ] **Cheaper extras on low tiers:** smaller bloom (or none), no multisampling, 8-bit render targets where half-float isn't supported (some old phones), a 30 fps default on battery and phones.
- [ ] **Don't redraw when nothing moves:** when paused and the camera is still, stop rendering (saves battery, keeps phones cool).
- [ ] **Lighter galaxies:** on low tiers draw galaxies with the cheap far-away version (no ray-marching), with fewer star points.
- [ ] **Load less up front:** compile only the shaders the current tier needs, and generate galaxy stars in a background worker so nothing hitches.

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

Shipped in stages 4a–4f. Old links still open the same worlds: `#123` is a plain seed as before, and places in galaxies have their own links (`#g5`, `#g5.s1234`, `#g5.n3`, `#u1`).

- [x] Galaxy shapes from a seed: spirals with 2 to 5 log-spiral arms, barred spirals, ellipticals and irregular clouds
- [x] A ray-marched glow: exponential disk, arms, a bulge and nucleus integrated exactly along each ray, a bar, dust lanes on the inside of each arm, pink star-forming knots
- [x] 60,000 to 150,000 stars per galaxy as GPU points that grow and brighten as you approach, dimmed by the dust in front of them
- [x] Colours follow the structure: young blue stars, Wolf-Rayet stars and protostars in the arms, old red and orange stars in the bulge and halo
- [x] Galaxy view: orbit it, zoom from the whole galaxy down to a single star
- [x] Every star has its own seed and opens as its own star system, of the same type the galaxy showed (`build(seed, {star})`)
- [x] Hover a star for its name, type and distance from the core; click to fly there and warp in
- [x] Zoom out (G) from a star system to its galaxy, right at that star, and from a galaxy to the universe
- [x] The sky of a star system in a galaxy shows that galaxy's band of light from where the star really is (and its neighbouring stars)
- [x] Supermassive black hole at the centre (star 0), with a sky full of the bulge's stars
- [x] Nebulae as places: ray-marched clouds with dark dust in the arms; flying into one opens a young system inside it
- [x] Globular clusters in the halo, open clusters in the arms
- [x] Warp jump between galaxy and star system: stars stretch into streaks, the screen washes out, the system is there
- [x] Free flight (F) in galaxy and universe views, with speed scaled to the zoom
- [x] Wallpaper: galaxies as a new kind to show (drifts around, sometimes dives into a star system and comes back out)
- [x] Universe view: 800 galaxies in clusters and filaments; fly into any of them (seamlessly: no warp needed)
- [x] Other galaxies seen from inside one, as the backdrop of the galaxy view
- [x] Links to any place: universe, galaxy, star, nebula and any planet or moon in it
- [x] Find (/): search galaxies, nebulae and every star of the current galaxy by name; go to a seed or link; random star, random galaxy, home galaxy
- [x] Visited stars are remembered and ringed in the galaxy view (the galaxy view is the map)
- [x] Galaxy shaders compiled in the background with the rest, and automatic quality covers the new views
- [x] The galaxy glow is ray-marched at half resolution (it's soft anyway), so galaxy views cost far less
- [x] Dwarf galaxies (most galaxies are small), red faded spirals and blue starbursts; irregulars as clumpy star clouds
- [x] Star-forming knots and irregular star clouds drawn as a crisp mid-plane layer (no streaks from any angle)
- [x] The cosmic web: faint gas along the universe's filaments and clusters; visited galaxies ringed, the one under the pointer highlighted
- [x] ⌂ Random worlds (W): leave the galaxies and go back to plain random worlds
- [x] Map-style navigation in galaxies and the universe: scroll zooms towards the pointer, right-drag or Shift-drag pans, and zooming far out drifts the view back to the galaxy's centre
- [x] Leaving a galaxy's star system: scroll out past its edge, Esc or Zoom out carries on to the galaxy (the Zoom out button stays visible there)
- [x] Dragging or scrolling takes over from any camera flight; clicking empty space at the overview does nothing instead of restarting a flight

Still open from phase 4:

- [ ] More stars streamed in near the camera (sectors), so a galaxy has millions instead of a fixed catalogue
- [ ] Rare systems (Dyson spheres, stations) more likely in fitting neighbourhoods, not just star types
- [ ] A small map overlay while you're inside a star system, showing where in the galaxy you are
- [ ] More than one universe in the UI (links like `#u2.g5` already work)

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
- [x] Phase 4: galaxies and the universe (above)
- [x] Backdrop nebulae in natural colours (no more green haze); distant dots, star points and far comet tails are soft round blobs instead of squares in the glow
- [x] Fixes from testing (October 2026):
  - Ice cracks: long, patchy fractures instead of an even mesh of squiggles
  - Rivers freeze over and vanish under snow (they showed as grey squiggles on ice caps)
  - Galaxy glow kept its tilt after the half-resolution change (tilted galaxies split into crescents)
  - Free flight in a galaxy no longer leaves the view frozen afterwards
  - Rings: an exact integer hash instead of `fract(sin())`, which broke into blocks and lines on some graphics cards; soft-edged planet shadow on the rings
  - A galaxy star system's sky no longer shows visited-star rings or streaks from edge-on star-forming knots
  - Galaxy shaders: shorter loops (much faster to compile on Windows), the nebula shader is warmed up, and every shader is drawn once off screen before it's needed
  - Clicking in a galaxy or the universe no longer locks the view for seconds
  - Your zoom is kept between random worlds again (it was lost when the code was split into modules): zoom out, and New, Space, clicking empty space and Back keep that distance (never closer than the new world's own framing); zoomed in, the next world starts at its default framing
  - Every shader now uses the exact integer hash (craters, city lights, volcano spots, lightning) instead of `fract(sin())`; fine details like crater spots and city layouts shifted once, worlds themselves are unchanged
- [x] Visual polish from testing: cities as connected sprawl with roads, crisp self-shadowing clouds, fine ring detail that stays sharp from below, real cratered asteroids and comet nuclei, four kinds of crystal world, faint polar hexagons, auroral rings around tipped magnetic poles
