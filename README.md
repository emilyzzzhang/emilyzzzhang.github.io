# Emily's Studio

An interactive 3D portfolio: a bright pink-and-white miniature studio, modelled entirely in
code with React Three Fiber, where each object opens a part of the portfolio — and Mochi the
cat naps on her cushion by the desk.

| Object in the studio | Section |
| --- | --- |
| Computer monitor | Projects |
| Coffee mug | About |
| Bookshelf | Education |
| Picture frames | Experience |
| Envelope | Contact |
| Résumé poster | Résumé (embedded PDF + open/download links) |
| Mochi | Wakes up, blinks, wiggles her ears, and goes back to sleep |

Every section is also reachable from the navigation bar, so the 3D scene is never required.
The sun/moon toggle in the top-right switches between day and night lighting and is remembered
per visitor.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
npm test           # vitest
```

## Customising

- **Content**: `src/data/profile.ts`, `src/data/projects.ts`, `src/data/experience.ts`.
- **Project screenshots**: put images in `public/images/projects/` and add
  `image: { src: 'images/projects/<name>.png', alt: '…' }` to a project. Missing or broken
  images fall back to an illustrated placeholder.
- **Résumé**: `public/resume.pdf`.
- **Mochi's look**: `src/config/mochi.ts` — fur/eye/nose colours, ear and tail shape, and
  which markings to show. The comments there explain what to match from a reference photo.
- **Colours & lighting**: `src/config/theme.ts` (3D, including the day/night lighting targets)
  and `src/styles/variables.css` (UI).
- **Layout**: furniture and object positions in `src/config/sceneLayout.ts`; camera presets in
  `src/config/camera.ts`.
- **Blender models**: add an entry to `src/config/models.ts` (e.g.
  `chair: { url: 'models/chair.glb' }`) and put the file in `public/models/`. The code-built
  version is used until the file loads, and if it fails to.
