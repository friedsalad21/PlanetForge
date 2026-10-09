# Working on PlanetForge

Notes for anyone (human or AI) making changes here. Sean (the owner) asked for these to be followed on every patch.

## Every change

- **Update the docs in the same commit:** tick or add items in `ROADMAP.md` (and bump its "Last updated" line), tick anything new in `VARIANTS.md` (the list of every kind of thing in space and which we have), and keep `README.md` in step with what the site does (features, controls, links, the code table). New controls also go in the help panel in `index.html`, and new wallpaper settings in `project.json`.
- **New features go on their own branch, not `main`.** `main` is the live site (GitHub Pages deploys it automatically), so it must always work. Branch from `main` as `feature/<short-name>`, commit and push there, and open a pull request into `main` for Sean to review. Only merge it when Sean says it works. Merge with a merge commit (not squash or rebase), so a broken feature can be undone in one step with the "Revert" button on its pull request.
- Small fixes to docs or notes (like this file) can go straight to `main`.
- **Leave nothing running:** stop local test servers and browsers when done.

## Keep in mind

- Old links (`#123`, `#123-p2m1`, `#g0.s1234`) don't have to keep showing the same worlds: new features may change what a seed generates when needed. Sean is fine with that.
- The "To review" items in `ROADMAP.md` (pulsar beams, black hole warping and zoom limit) are only to be done when Sean asks.
- The page must be served over http (ES modules); `python3 -m http.server` in the repo is enough. Nothing is built; three.js is bundled in `lib/`.
- Shaders: for random numbers use `rhash` / `hash3` / `n1` from `src/shaders.js` (exact integer hashes), never `fract(sin(x))`, which breaks on many GPUs. Keep shader loops short (64 or less where possible): long loops are slow to compile on Windows/DirectX.
- Type `PF` in the browser console for a debug handle (`PF.S`, `PF.L`, `PF.nav`, `PF.go(id)`).
