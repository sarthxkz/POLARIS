---
name: POLARIS
description: World Intelligence System. Navigate the Bigger Picture.
colors:
  ground: "#04070c"
  surface: "#0a1019"
  raised: "#111a26"
  hover: "#172231"
  line: "#1b2635"
  line-strong: "#2a394d"
  ink: "#e9eff7"
  ink-soft: "#a3b1c4"
  ink-faint: "#7d8ca1"
  cyan: "#52d3f2"
  cyan-deep: "#0e3646"
  glacier: "#8fc3f5"
  amber: "#f2b24c"
  frost: "#dce8f5"
  coral: "#ff8b78"
  red: "#ff5d5d"
  sand: "#cdb68c"
  aircraft: "#c9d6e6"
  print-paper: "#ffffff"
typography:
  display:
    fontFamily: "Work Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(30px, 3.2vw, 46px)"
    fontWeight: 300
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Work Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(24px, 2vw, 30px)"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Work Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.375
  body-read:
    fontFamily: "Work Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Work Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Work Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.43
  caption:
    fontFamily: "Work Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
  micro:
    fontFamily: "Work Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: "1rem"
  wordmark:
    fontFamily: "Work Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    letterSpacing: "0.08em"
rounded:
  control: "6px"
  panel: "10px"
  full: "9999px"
spacing:
  bar-h: "56px"
  rail-w: "296px"
  panel-w: "368px"
  timeline-h: "88px"
  edge: "12px"
  read-gutter: "40px"
  read-section: "120px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.control}"
    size: "36px"
  icon-button-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.ink}"
  segment:
    backgroundColor: "transparent"
    textColor: "{colors.ink-faint}"
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
  segment-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "36px"
    width: "440px"
  instrument-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  layer-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "6px 8px"
  layer-row-hover:
    backgroundColor: "{colors.hover}"
  nav-link:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.control}"
    padding: "10px 10px"
  nav-link-current:
    textColor: "{colors.ink}"
  read-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px"
    height: "38px"
  read-row-hover:
    backgroundColor: "{colors.raised}"
---

# Design System: POLARIS

## Overview

**Creative North Star: "The Quiet Instrument Over the Real Earth"**

The Earth is the interface. NASA GIBS imagery is the planet's surface (Sentinel-2 cloudless by EOX by day, city lights by night, true-colour swaths and cloud infrared as layers), the terminator is real, and the globe runs edge to edge. Everything else is a small set of exact instrument readouts pinned to the window's edges: a top bar, a layer rail, an event feed that the selected object's details replace, and a seven-day timeline. Chrome is opaque graphite-navy on a midnight ground, typed in Work Sans at light-to-medium weights with tabular figures, and it never competes with the planet.

Colour belongs to data. Markers carry four hue families plus glacier blue for orbital estimates; cyan exists only for the selected object and keyboard focus. The read pages (Events, Satellites, Sources, About) share the same ground, ink and type but slow down: a split hero with a light display headline on one half and a live working fragment of the product on the other, then a narrow reading column with generous section breaks and two-ended rows with nothing drawn between them.

The system refuses both the category default (a small boxed globe in a grid of KPI cards) and its opposite (a neon command-centre HUD with scan lines and glowing borders).

**Key Characteristics:**
- Full-bleed lit globe; chrome as opaque edge-pinned instruments, never frosted glass over WebGL.
- Midnight ground, three-step graphite-navy surfaces, cool-white ink in three strengths.
- Data colour in four families plus glacier for estimates; cyan reserved for selection and focus.
- Work Sans 300/400/500, tabular figures on every number, sentence case throughout.
- Hairlines inside panels only; depth from tone, with one shadow reserved for floating popovers.
- The chrome POLARIS mark is the only metallic object.

## Colors

A near-black blue world in which hue is evidence: the chrome is colourless, and anything coloured is a measurement.

### Primary
- **Selection Cyan** (`cyan`): the selected object's ring (drawn once, 1.75px stroke), the selected satellite or aircraft on the globe, the focus outline (2px, 2px offset) and the satellite view's target ring. Its deep companion **Abyss Cyan** (`cyan-deep`) is the text-selection background.

### Secondary
- **Glacier Estimate Blue** (`glacier`): satellites positioned from orbital elements (SGP4). Blue says "estimated", never "observed".

### Tertiary (data families)
- **Heat Amber** (`amber`): wildfires, volcanoes, temperature extremes; also stale or rate-limited feeds and warning notices.
- **Water and Ice Frost** (`frost`): severe storms, floods, sea and lake ice, snow, water colour; storm tracks are drawn in frost at 32% alpha.
- **Quake Coral** (`coral`): earthquakes below M6, as filled discs sized by magnitude.
- **Critical Red** (`red`): earthquakes at M6 and above (USGS threshold), feeds that are down, error notices. Nothing else.
- **Sand** (`sand`): landslides, dust and haze, drought, human-made events.
- **Aircraft Grey** (`aircraft`): aircraft dots at 40% alpha; deliberately colourless so traffic reads as texture, not as an event family.

### Neutral
- **Midnight Ground** (`ground`): page and panel ground behind everything; also the dark disc behind every event marker (82% opacity) and marker outlines.
- **Graphite Navy Surface** (`surface`): every instrument panel, popover, the search field, the read-page hero's fragment half; also the globe's base colour before imagery loads.
- **Raised** (`raised`): selected segment, hover tooltip, read-row hover, skeleton bars.
- **Hover** (`hover`): hover fill on rows and icon buttons inside panels.
- **Hairline** (`line`) and **Strong Hairline** (`line-strong`): panel borders and internal section dividers; strong is for the off switch, focused field border, dashed empty states and the scrollbar thumb.
- **Ink** (`ink`), **Soft Ink** (`ink-soft`), **Faint Ink** (`ink-faint`): primary text; secondary text and inactive controls; captions, units, ages and metadata.

### Print
The print stylesheet swaps the dark world for paper: ground and surfaces become print-paper #ffffff and ink becomes #000000, with soft and faint inks at #333333 and #555555. Interactive chrome (header actions, footer nav, back-to-top, skip link) is left off the page.

### The Open-Space Field (accepted exception)
The space around the globe is Cesium's real star-catalogue skybox, not the midnight ground. It samples near-neutral black (about #040404) with real stars. This is an accepted exception from the finish review: the void is the actual sky, while panels and read pages carry `ground`. Do not tint the skybox to match the ground and do not replace it with a flat fill.

### Named Rules
**The Colour-Is-Evidence Rule.** Data colour uses four families only: heat amber, water/ice frost, quake coral rising to critical red at M6+, and sand for everything else. Glacier blue is reserved for satellite estimates. Category inside a family is told apart by its glyph, never by a new hue.

**The One Cyan Rule.** Cyan marks the selected object and keyboard focus. It is not a brand accent, not a button fill and not decoration.

**The Red-Means-Critical Rule.** Red appears only for M6+ earthquakes, unavailable feeds and errors.

## Typography

**Display Font:** Work Sans (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Work Sans
**Label/Mono Font:** Work Sans with `font-variant-numeric: tabular-nums` on every number

**Character:** One humanist grotesque across the whole product, used light at large sizes and medium for small labels, so headlines feel calm and readouts feel exact.

### Hierarchy
- **Display** (300, clamp(30px, 3.2vw, 46px), 1.05, -0.03em): read-page hero headline only, two lines, each rising once from behind its own baseline.
- **Headline** (400, clamp(24px, 2vw, 30px), tight, -0.015em): read-page section titles.
- **Title** (500, 18px, snug): the selected object's name at the top of the details panel.
- **Body Read** (400, 17px, 1.6): read-page paragraphs and hero sentence, max about 46-60ch in a 560px column.
- **Body** (400, 14px, 1.43): all Explorer chrome text, list rows, search.
- **Label** (500, 13px): panel and rail section heads ("Natural events", "Events · 451"), detail sub-heads.
- **Caption** (400, 12px): metadata, ages, sources, segment labels, group labels in sentence case, in faint ink.
- **Micro** (400, 11px): tagline under the wordmark, search hints, Cesium credits.
- **Wordmark** (500, 15px, 0.08em): the word POLARIS beside the mark only.

### Named Rules
**The Tabular Truth Rule.** Every count, time, coordinate, magnitude and age is set in tabular figures, usually paired with its unit or "UTC" in faint ink.

**The Sentence Case Rule.** Labels, group heads and buttons are sentence case at normal tracking. Tracked capitals belong to the POLARIS wordmark alone.

## Layout

**Explorer.** The globe fills the viewport behind fixed chrome. A 56px top bar holds the mark and wordmark (left), a 440px search field (centre), site nav, UTC clock and feed count (right), each cluster on its own surface pill so the globe shows between them. At rest the globe owns the screen: the layer rail folds to a "Layers" chip (top left) and the event feed to an "Events n" chip (top right), and a single light-weight sentence states the live picture bottom left ("Right now 6,768 aircraft are aloft, 320 satellites… and 503 natural events…"; never metric tiles). Opened, the layer rail (296px) floats 12px from the left edge and the event feed / details panel (368px) 12px from the right; details open on selection; both stop 20px above the 88px timeline at the bottom centre. Panel heights are bounded by the bar and timeline, and their content scrolls inside with contained overscroll. Rotate (pause/play), zoom and home controls sit as a small vertical stack inside the right margin of the globe. The timeline centres itself (max 760px) when the side panels are folded.

**Phones.** One region at a time in a bottom sheet (events with the time window, layers, or details); the globe takes the upper part of the screen; feed status stays in the top bar; the replay timeline is desktop only.

**Read pages.** A full-height two-column hero: left half on ground with the headline anchored low, right half on surface holding a live product fragment no wider than 460px. Below, a 560px reading column whose left edge sits at max(40px, 22vw); sections are separated by 120px; a footer arrives after 30svh of air. On phones the fragment stacks above the text and gutters drop to 20px.

**Rhythm.** Internal panel padding is 6-16px in 2px steps (rows 6-9px vertical, section heads 14px); touch rows reach 44px on phones.

## Elevation & Depth

Flat and tonal. Depth comes from the three surface steps (ground, surface, raised) and 1px hairlines, not from shadows. Panels over the globe are opaque; there is no backdrop blur over WebGL. Real depth belongs to the planet: sun-driven lighting, ground and sky atmosphere, fog.

### Shadow Vocabulary
- **Popover** (`box-shadow: 0 16px 40px rgba(0,0,0,0.55)`): menus that float off the top bar (search results, data feeds, display options).
- **Hover tag** (`box-shadow: 0 6px 20px rgba(0,0,0,0.45)`): the small label that follows the pointer over a globe object.

### Named Rules
**The Opaque Instrument Rule.** Panels over the globe are solid surface with a hairline border, never frosted, never glowing.

**The Shadow-Only-Floats Rule.** Only transient popovers and the hover tag cast shadows; docked panels and read pages are flat.

## Shapes

Gently softened rectangles: controls, rows, segments and buttons at 6px; panels, popovers and top-bar pills at 10px; status dots, switches and quake discs fully round. Borders are 1px hairlines; empty states use a dashed strong hairline. Event markers on the globe are 44px dark discs with a 2.5px ring and a Lucide-derived line glyph in the family colour; earthquakes follow seismological convention as filled discs (38% fill, 1.5px stroke) sized 7px plus 4.2px per magnitude above 2.5. The brand mark is a 14px-radius dark tile holding a chrome orbit ellipse crossing a four-point star.

## Components

### Buttons
- **Shape:** gently rounded (6px).
- **Primary:** ink fill with midnight text, 500 weight, 15px on read pages (10px 16px) and 14px in the site header (8px 12px). Used once per view ("See them on the globe", "Open the globe").
- **Icon button:** 36px square, transparent, soft ink; hover fills `hover` and lifts to ink; disabled at 40% opacity.
- **Press:** every pressable control scales to 0.96 on active (140ms, ease-out); colour changes take 150ms. Reduced motion removes the scale.

### Chips (segmented controls)
- **Style:** a row of 6px text segments at 12px in faint ink; no track, no border.
- **State:** the selected segment fills `raised` with ink text; hover lifts to soft ink. Used for time window, altitude band and sort.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** `surface`.
- **Shadow Strategy:** none when docked; popovers use the popover shadow.
- **Border:** 1px `line`; internal sections divided by `line`.
- **Internal Padding:** 14px section heads, 6px row gutters.

### Inputs / Fields
- **Style:** 36px search field, surface fill, 1px hairline, 6px radius, 16px line magnifier in faint ink, faint placeholder.
- **Focus:** the border steps up to `line-strong`; keyboard focus elsewhere is a 2px cyan outline at 2px offset.
- **Switch:** 30x18px; off is a strong-hairline outline with a faint knob, on fills soft ink with a midnight knob. The whole row is the hit area.

### Navigation
- **Explorer:** links in a surface pill in the top bar; current page in ink at 500, others soft ink.
- **Read pages:** wordmark left, 15px links right in soft ink, current in ink, then the ink primary "Open the globe". Footer: three columns, product name, links, "Public data, cited at source".

### Status Dot
A 7px round dot beside each feed: live, stale/rate-limited in amber, down in red, idle in faint ink, always followed by its word label so colour is never the only signal.

### Selection Ring (signature)
Select an object: the camera flies there (cubic in-out, 1.4-1.6s), a cyan ring draws itself once around the object (520ms stroke-dashoffset), and the side panel crossfades from feed to details (180ms blur crossfade). Panels arriving on demand slide 12px from their edge over 220ms.

### Globe Motion
The globe turns west to east at 1.6°/s when idle, easing in over 1.5s after 5s without input and stopping the instant it is touched (off under reduced motion; pause/play in the controls and settings). First visit only: the canvas fades in over 900ms once its first tiles draw while the camera glides in from 2.3x distance (2.8s, quartic out), and the chrome arrives from its own edges (top, left, right, bottom; 560-640ms, delays 300-620ms); after arrival the same panels answer clicks in 240ms with no delay. Satellites glide between once-a-second SGP4 keyframes every frame and trail their last three minutes in glacier at 32%. Selecting a satellite flies out beside it (2.4s) and hands the camera to Cesium's entity tracking (east-north-up frame), with a live readout card beside the ring that flips left near the right edge.

### Sunlight and the Sun
Sunlight is real and always applied (Cesium's default switches lighting off closer than ~10,000 km; POLARIS keeps it at every distance): the day side is lit from the Sun's true position at the current time, night keeps half its detail (vertex shadow 0.5) with VIIRS city lights. The Sun is drawn with a 2.2x glow. While the globe turns, the gaze leans up to 25 degrees toward the Sun as it nears the frame so it rises beside the limb; "Face the Sun" (controls stack) flies to a view 140 degrees round from the Sun where its light falls on the day-side crescent, and holds there until the globe is touched. Rendering is full device resolution capped at 2x, with tile screen-space error 1.

### Read Row
A two-ended row: glyph or status dot, 16px name with a 14px soft sub-line on the left, a short tabular value at the far right; nothing drawn between rows; linked rows take a `raised` hover. On phones the value drops under the name.

## Do's and Don'ts

### Do:
- **Do** let the globe own the viewport and pin chrome to the edges as opaque `surface` panels with a 1px `line` border.
- **Do** colour data from the four families (amber, frost, coral to red at M6+, sand) and glacier for satellite estimates; distinguish categories within a family by glyph.
- **Do** keep cyan for the selected object and keyboard focus.
- **Do** set every number in tabular figures with its time, unit or source beside it in faint ink.
- **Do** leave the open-space field as Cesium's real star skybox (about #040404) while panels and read pages sit on `ground`.
- **Do** honour `prefers-reduced-motion`: entrances become a 160-200ms fade and press scaling stops.
- **Do** give read-page heroes a live working fragment of the product, never a picture of it.

### Don't:
- **Don't** blur or frost panels over the WebGL globe.
- **Don't** add a new hue for a new event category, or use red for anything but critical states.
- **Don't** use cyan as a button fill, brand accent or decoration.
- **Don't** add scan lines, glowing borders or HUD brackets; this is an instrument, not a command centre.
- **Don't** box the globe into a card grid of KPI tiles.
- **Don't** put chrome or metallic sheen anywhere except the POLARIS mark.
- **Don't** add tracked uppercase labels or eyebrows above headings.
