---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/events/page.tsx","src/app/sources/page.tsx","src/app/satellites/page.tsx","src/app/about/page.tsx"]
---

Scope: the Explorer (`/`), an Experience surface — the visitor is inside the globe. Related Read surfaces (`/events`, `/satellites`, `/sources`, `/about`) follow the quiet-instrument direction dealt by design-taste-frontend (seed 583124914) inside the same world.

Audience and job: the curious public, a few minutes per visit, laptop or phone. Job: find something real happening on Earth now, open it, and see where the information came from and how old it is.

## Direction contract

THESIS: The Earth is the interface. The globe runs edge to edge and all chrome is a few exact instrument readouts pinned to the window's edges. Refuses the category default (a small globe boxed by a grid of KPI cards) and its opposite (a neon "command centre" HUD with scan lines and glowing borders).

OWN-WORLD: Midnight ground, opaque graphite/navy panels (no blur over WebGL), cool-white ink plus one soft ink, Work Sans 300/400/500 with tabular figures. Colour lives on data only: cyan = the selected object and the one primary action; glacier blue = orbital estimates; amber = fire, heat and stale feeds; red = critical (M6+ quakes, feed down). Hairlines only inside data panels. NASA GIBS imagery is the planet's surface: real Blue Marble by day, real city lights by night, today's true-colour swaths and cloud infrared as layers. The POLARIS chrome mark is the only metallic object.

STORY: The visitor lands on today's planet with the real terminator and lit cities, sees each layer's count and age, picks a fire, a storm, a quake, an aircraft or a satellite, and the camera travels there. The panel says what, where, when and from whom, and the feed list says plainly which sources are live, stale or down.

FIRST VIEWPORT: The globe fills the viewport, centred a little right of the window centre to clear the 288px layer rail. Top-left: mark, POLARIS wordmark, tagline in soft ink. Top-centre: a 440px search field (the primary action). Top-right: UTC clock and "n of m feeds live". Left: the layer rail with counts and ages. Bottom: a 7-day event timeline. At rest both side panels fold to chips ("Layers", "Events n") so the globe owns the screen, turning slowly with satellites streaming, and one light sentence states the live counts bottom left. Right: the event feed the brief requires (§F, "compact event feed... click to focus the globe"), foldable so the globe can own the right edge; the selected object's details replace it on selection. Phones: one region at a time in a bottom sheet (events with the time window, or layers, or details); feed status stays in the top bar; the replay timeline is a desktop instrument.

FORM: Brief-pinned geospatial instrument for the Explorer; quiet-instrument (design-taste-frontend, position 1 of 3 dealt) for Read pages. Signature interaction: select → camera flies (strong ease-in-out) → a cyan ring draws once around the object → the panel crossfades in under 200ms. seed: none (brief-pinned direction; concept-seed was not run because the brief pins the visual world, disclosed to the user)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
