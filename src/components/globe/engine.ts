import {
  BillboardCollection,
  Cartesian2,
  Cartesian3,
  CesiumWidget,
  Color,
  Credit,
  EasingFunction,
  HorizontalOrigin,
  ImageryLayer,
  JulianDate,
  LabelCollection,
  LabelStyle,
  Material,
  DistanceDisplayCondition,
  Math as CesiumMath,
  NearFarScalar,
  PointPrimitiveCollection,
  PolylineCollection,
  SceneTransforms,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  VerticalOrigin,
  WebMercatorTilingScheme,
  type Billboard,
  type Label,
  type PointPrimitive,
  type Polyline,
} from "cesium";
import { aircraftMarker, eventImage } from "./markers";
import { DATA } from "@/lib/palette";
import { estimate, orbitPath, type SatelliteTrack } from "@/lib/orbits";
import type { AircraftRow, NaturalEvent } from "@/lib/types";

export type Selection =
  | { kind: "event"; id: string }
  | { kind: "aircraft"; id: string }
  | { kind: "satellite"; id: number }
  | { kind: "place"; id: string; lat: number; lon: number; label: string };

export type PickInfo = { kind: Selection["kind"]; id: string | number; label: string };

export type ImageryKey = "nightLights" | "trueColor" | "clouds" | "precipitation" | "borders" | "labels";

interface EngineOptions {
  reducedMotion: boolean;
  lowPower: boolean;
}

export interface CountryLabel {
  name: string;
  lon: number;
  lat: number;
  rank: number;
}
export interface CityLabel {
  name: string;
  lon: number;
  lat: number;
  rank: number;
}

/** Aircraft draw only when the camera is closer than this; the rail says so. */
export const AIRCRAFT_VISIBLE_WITHIN_M = 9_000_000;

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const naturalEarthCredit = new Credit(
  '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Borders and names: Natural Earth</a>',
);
const gibsCredit = new Credit(
  '<a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">Imagery: NASA GIBS</a>',
);

function gibsLayer(layer: string, time: string | null, tms: string, ext: string, maximumLevel: number) {
  const timePart = time === null ? "" : `${time}/`;
  return new UrlTemplateImageryProvider({
    url: `${GIBS}/${layer}/default/${timePart}${tms}/{z}/{y}/{x}.${ext}`,
    tilingScheme: new WebMercatorTilingScheme(),
    maximumLevel,
    credit: gibsCredit,
  });
}

/** The globe, its imagery, and every marker. Lives outside React; React talks to it by method calls. */
export class GlobeEngine {
  readonly widget: CesiumWidget;
  private handler: ScreenSpaceEventHandler;
  private events = new BillboardCollection();
  private aircraft = new BillboardCollection();
  private aircraftPoints = new PointPrimitiveCollection();
  private satellites = new PointPrimitiveCollection();
  private paths = new PolylineCollection();
  private borders = new PolylineCollection();
  private labels = new LabelCollection();
  private imagery: Partial<Record<ImageryKey, ImageryLayer>> = {};
  private eventById = new Map<string, { event: NaturalEvent; billboard: Billboard }>();
  private aircraftById = new Map<string, { row: AircraftRow; billboard: Billboard; point: PointPrimitive }>();
  private satelliteById = new Map<number, { track: SatelliteTrack; point: PointPrimitive }>();
  private selection: Selection | null = null;
  private selectionPaths: Polyline[] = [];
  private satelliteTimer: number | null = null;
  private lightingTimer: number | null = null;
  private eventFilter: (e: NaturalEvent) => boolean = () => true;
  private aircraftFilter: (row: AircraftRow) => boolean = () => true;
  private satelliteFilter: (t: SatelliteTrack) => boolean = () => true;
  private hoverAt = 0;
  private destroyed = false;
  /** Seconds the latest selection's camera flight takes (0 when the camera did not move). */
  private lastFlightSeconds = 0;
  /** Called after each selection with the length of its camera flight in seconds. */
  onFlight: (seconds: number) => void = () => {};

  onSelect: (selection: Selection | null) => void = () => {};
  onHover: (info: (PickInfo & { x: number; y: number }) | null) => void = () => {};
  /** Screen position of the selected object every rendered frame (null when off-screen). */
  onSelectionScreen: (point: { x: number; y: number } | null) => void = () => {};
  onCameraHeight: (metres: number) => void = () => {};
  /** Click on open ground (no object under the pointer), with its coordinates. */
  onPickGround: (point: { lon: number; lat: number } | null) => void = () => {};

  /** Replaces any of the callbacks above. */
  setHandlers(
    handlers: Partial<
      Pick<GlobeEngine, "onSelect" | "onHover" | "onSelectionScreen" | "onCameraHeight" | "onPickGround" | "onFlight">
    >,
  ) {
    Object.assign(this, handlers);
  }

  constructor(container: HTMLElement, private options: EngineOptions) {
    const base = new ImageryLayer(
      gibsLayer("BlueMarble_ShadedRelief_Bathymetry", null, "GoogleMapsCompatible_Level8", "jpeg", 8),
    );

    this.widget = new CesiumWidget(container, {
      baseLayer: base,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      useBrowserRecommendedResolution: true,
      scene3DOnly: true,
      msaaSamples: options.lowPower ? 1 : 4,
      showRenderLoopErrors: false,
      shouldAnimate: true,
      blurActiveElementOnCanvasFocus: false,
    });

    const { scene, clock } = this.widget;
    if (options.lowPower) this.widget.resolutionScale = 0.8;

    const globe = scene.globe;
    globe.baseColor = Color.fromCssColorString("#0a1019");
    globe.enableLighting = true; // real terminator from the sun's position at the current time
    globe.dynamicAtmosphereLighting = true;
    globe.dynamicAtmosphereLightingFromSun = true;
    globe.showGroundAtmosphere = !options.lowPower;
    globe.maximumScreenSpaceError = options.lowPower ? 3 : 2;
    globe.tileCacheSize = 200;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
    scene.fog.enabled = true;
    scene.backgroundColor = Color.fromCssColorString("#04070c");
    if (scene.moon) scene.moon.show = false;

    const camera = scene.screenSpaceCameraController;
    camera.minimumZoomDistance = 2_000;
    camera.maximumZoomDistance = 45_000_000;
    camera.inertiaSpin = options.reducedMotion ? 0 : 0.85;
    camera.inertiaZoom = options.reducedMotion ? 0 : 0.7;

    clock.currentTime = JulianDate.now();

    scene.primitives.add(this.borders);
    scene.primitives.add(this.labels);
    scene.primitives.add(this.paths);
    scene.primitives.add(this.events);
    scene.primitives.add(this.satellites);
    scene.primitives.add(this.aircraftPoints);
    scene.primitives.add(this.aircraft);

    this.addImagery("nightLights", true);

    this.home(false);

    this.handler = new ScreenSpaceEventHandler(scene.canvas);
    this.handler.setInputAction(
      (e: ScreenSpaceEventHandler.PositionedEvent) => this.handleClick(e.position),
      ScreenSpaceEventType.LEFT_CLICK,
    );
    this.handler.setInputAction(
      (e: ScreenSpaceEventHandler.MotionEvent) => this.handleHover(e.endPosition),
      ScreenSpaceEventType.MOUSE_MOVE,
    );

    scene.postRender.addEventListener(() => this.reportSelectionScreen());
    camera.enableTilt = true;
    scene.camera.changed.addEventListener(() => {
      this.onCameraHeight(scene.camera.positionCartographic.height);
      this.refreshOcclusion();
    });
    scene.camera.moveEnd.addEventListener(() => this.refreshOcclusion());
    scene.camera.percentageChanged = 0.05;

    // Keep the day/night terminator honest while the visitor is idle.
    this.lightingTimer = window.setInterval(() => this.render(), 60_000);
  }

  private render() {
    if (!this.destroyed) this.widget.scene.requestRender();
  }

  /* ───────────────────────────── Imagery ───────────────────────────── */

  private imageryTimes: Record<string, string | null> = {};

  setImageryTimes(times: Record<string, string | null>) {
    const changed = JSON.stringify(times) !== JSON.stringify(this.imageryTimes);
    this.imageryTimes = times;
    if (!changed) return;
    // Rebuild any visible time-dependent layer at its newly published time.
    for (const key of ["trueColor", "clouds", "precipitation"] as const) {
      if (this.imagery[key]) {
        this.removeImagery(key);
        this.addImagery(key, true);
      }
    }
  }

  private buildImagery(key: ImageryKey): ImageryLayer[] {
    const t = (layer: string) => this.imageryTimes[layer] ?? null;
    switch (key) {
      case "nightLights": {
        const layer = new ImageryLayer(
          gibsLayer("VIIRS_Black_Marble", "2016-01-01", "GoogleMapsCompatible_Level8", "png", 8),
          { dayAlpha: 0, nightAlpha: 1 },
        );
        return [layer];
      }
      case "trueColor": {
        const time = t("VIIRS_SNPP_CorrectedReflectance_TrueColor")?.slice(0, 10) ?? "default";
        return [
          new ImageryLayer(
            gibsLayer("VIIRS_SNPP_CorrectedReflectance_TrueColor", time, "GoogleMapsCompatible_Level9", "jpg", 9),
            { nightAlpha: 0.25 },
          ),
        ];
      }
      case "clouds": {
        // Three geostationary imagers; Europe, Africa and the Indian Ocean are not covered in this set.
        return (
          [
            "GOES-East_ABI_Band13_Clean_Infrared",
            "GOES-West_ABI_Band13_Clean_Infrared",
            "Himawari_AHI_Band13_Clean_Infrared",
          ] as const
        ).map(
          (layer) =>
            new ImageryLayer(gibsLayer(layer, t(layer) ?? "default", "GoogleMapsCompatible_Level6", "png", 6), {
              alpha: 0.55,
            }),
        );
      }
      case "precipitation": {
        const layer = "IMERG_Precipitation_Rate_30min";
        return [
          new ImageryLayer(gibsLayer(layer, t(layer) ?? "default", "GoogleMapsCompatible_Level6", "png", 6), {
            alpha: 0.85,
          }),
        ];
      }
      case "borders":
      case "labels":
        return [];
    }
  }

  private imageryGroups: Partial<Record<ImageryKey, ImageryLayer[]>> = {};

  private addImagery(key: ImageryKey, show: boolean) {
    if (!show || this.imageryGroups[key]) return;
    const layers = this.buildImagery(key);
    const collection = this.widget.scene.imageryLayers;
    for (const layer of layers) collection.add(layer);
    // Labels and borders always sit on top of data imagery.
    for (const top of ["borders", "labels"] as const) {
      for (const l of this.imageryGroups[top] ?? []) collection.raiseToTop(l);
    }
    this.imageryGroups[key] = layers;
    this.imagery[key] = layers[0];
    this.render();
  }

  private removeImagery(key: ImageryKey) {
    for (const layer of this.imageryGroups[key] ?? []) this.widget.scene.imageryLayers.remove(layer, true);
    delete this.imageryGroups[key];
    delete this.imagery[key];
  }

  setImagery(key: ImageryKey, show: boolean) {
    if (key === "borders" || key === "labels") {
      (key === "borders" ? this.borders : this.labels).show = show;
      this.render();
      return;
    }
    if (show) this.addImagery(key, true);
    else this.removeImagery(key);
    this.render();
  }

  /* ─────────────────────── Borders and place names ─────────────────────── */

  /** Natural Earth land boundaries as flat [lon, lat, ...] arrays. */
  setBorders(lines: number[][]) {
    this.borders.removeAll();
    const material = Material.fromType("Color", { color: Color.fromCssColorString("#dce8f5").withAlpha(0.32) });
    for (const flat of lines) {
      const positions = Cartesian3.fromDegreesArray(flat);
      this.borders.add({ positions, width: 1, material });
    }
    this.widget.creditDisplay.addStaticCredit(naturalEarthCredit);
    this.render();
  }

  /** Each label with its approximate on-screen text box, for hiding labels under panels. */
  private labelMeta: { label: Label; width: number; left: boolean }[] = [];
  private labelScratch = new Cartesian2();

  /**
   * Hides any place name whose text would run under an interface panel (elements marked
   * `data-occludes-globe`), so a panel edge never leaves a word fragment like "g Kong".
   * Runs on camera changes and layout changes, not every frame.
   */
  refreshOcclusion() {
    if (this.destroyed || this.labelMeta.length === 0) return;
    const canvas = this.widget.canvas.getBoundingClientRect();
    const pad = 4;
    const blocks = [...document.querySelectorAll<HTMLElement>("[data-occludes-globe]")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        l: r.left - canvas.left - pad,
        t: r.top - canvas.top - pad,
        r: r.right - canvas.left + pad,
        b: r.bottom - canvas.top + pad,
      }));
    let changed = false;
    for (const m of this.labelMeta) {
      const s = SceneTransforms.worldToWindowCoordinates(this.widget.scene, m.label.position, this.labelScratch);
      let hide = false;
      if (s) {
        const x0 = m.left ? s.x + 6 : s.x - m.width / 2;
        const x1 = x0 + m.width;
        hide = blocks.some((b) => x1 > b.l && x0 < b.r && s.y + 8 > b.t && s.y - 8 < b.b);
      }
      if (m.label.show === hide) {
        m.label.show = !hide;
        changed = true;
      }
    }
    if (changed) this.render();
  }

  setPlaceLabels(countries: CountryLabel[], cities: CityLabel[], font: string) {
    this.labels.removeAll();
    this.labelMeta = [];
    const ink = Color.fromCssColorString("#e9eff7");
    const soft = Color.fromCssColorString("#a3b1c4");
    const outline = Color.fromCssColorString("#04070c").withAlpha(0.85);
    for (const c of countries) {
      // Larger countries (low label rank) stay labelled from further away.
      const far = c.rank <= 2 ? 1.1e7 : c.rank <= 4 ? 5e6 : 2.5e6;
      const label = this.labels.add({
        position: Cartesian3.fromDegrees(c.lon, c.lat, 0),
        text: c.name,
        font: `500 12px ${font}`,
        fillColor: ink.withAlpha(0.82),
        outlineColor: outline,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        distanceDisplayCondition: new DistanceDisplayCondition(0, far),
        scaleByDistance: new NearFarScalar(1e6, 1.1, 2e7, 0.85),
      });
      // Text width estimate for a 12px grotesk (~0.6em per character), at the largest scale.
      this.labelMeta.push({ label, width: c.name.length * 7.3 * 1.1, left: false });
    }
    // Cities that sit on top of a country's label point would collide with it; skip those.
    const clear = cities.filter(
      (city) => !countries.some((c) => Math.abs(c.lat - city.lat) < 1.6 && Math.abs(c.lon - city.lon) < 2.2),
    );
    for (const c of clear) {
      const far = c.rank <= 1 ? 2.5e6 : 1.5e6;
      const label = this.labels.add({
        position: Cartesian3.fromDegrees(c.lon, c.lat, 0),
        text: c.name,
        font: `400 11px ${font}`,
        fillColor: soft,
        outlineColor: outline,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.CENTER,
        pixelOffset: new Cartesian2(6, 0),
        distanceDisplayCondition: new DistanceDisplayCondition(0, far),
      });
      this.labelMeta.push({ label, width: c.name.length * 6.6, left: true });
    }
    this.refreshOcclusion();
    this.render();
  }

  /* ───────────────────────────── Events ───────────────────────────── */

  setEvents(events: NaturalEvent[]) {
    const next = new Set(events.map((e) => e.id));
    for (const [id, entry] of this.eventById) {
      if (!next.has(id)) {
        this.events.remove(entry.billboard);
        this.eventById.delete(id);
      }
    }
    for (const event of events) {
      const { image } = eventImage(event.category, event.magnitude?.value ?? null, event.status === "closed");
      const position = Cartesian3.fromDegrees(event.lon, event.lat, 0);
      const existing = this.eventById.get(event.id);
      if (existing) {
        existing.event = event;
        existing.billboard.position = position;
        existing.billboard.image = image;
        continue;
      }
      const billboard = this.events.add({
        position,
        image,
        width: event.category === "earthquakes" ? undefined : 22,
        height: event.category === "earthquakes" ? undefined : 22,
        scale: event.category === "earthquakes" ? 0.5 : 1,
        verticalOrigin: VerticalOrigin.CENTER,
        horizontalOrigin: HorizontalOrigin.CENTER,
        scaleByDistance: new NearFarScalar(1.5e5, 1.25, 2.4e7, 0.6),
        disableDepthTestDistance: 0,
        id: { kind: "event", id: event.id, label: event.title } satisfies PickInfo,
      });
      this.eventById.set(event.id, { event, billboard });
    }
    this.applyEventFilter();
  }

  setEventFilter(filter: (e: NaturalEvent) => boolean) {
    this.eventFilter = filter;
    this.applyEventFilter();
  }

  /**
   * Replay: with a time cursor, each event sits at its latest sample at or before the cursor
   * (storm tracks move); events not yet observed by then are hidden.
   */
  private cursor: number | null = null;
  setTimeCursor(ms: number | null) {
    this.cursor = ms;
    this.applyEventFilter();
  }

  private applyEventFilter() {
    for (const { event, billboard } of this.eventById.values()) {
      let show = this.eventFilter(event);
      if (show && this.cursor !== null) {
        const cursorIso = new Date(this.cursor).toISOString();
        const sample = [...event.track].reverse().find((p) => p.time <= cursorIso);
        if (sample) billboard.position = Cartesian3.fromDegrees(sample.lon, sample.lat, 0);
        else show = false;
      } else if (this.cursor === null) {
        billboard.position = Cartesian3.fromDegrees(event.lon, event.lat, 0);
      }
      billboard.show = show;
    }
    this.render();
  }

  /* ───────────────────────────── Aircraft ───────────────────────────── */

  /**
   * Two representations per aircraft: from far away a 2px point (thousands of icons at globe
   * scale read as noise), and within ~4,000 km a plane icon rotated to its reported track.
   */
  private static NEAR = new DistanceDisplayCondition(0, 4_000_000);
  private static FAR = new DistanceDisplayCondition(4_000_000, AIRCRAFT_VISIBLE_WITHIN_M);

  setAircraft(rows: AircraftRow[]) {
    const next = new Set<string>();
    const image = aircraftMarker("air");
    const dot = Color.fromCssColorString(DATA.aircraft).withAlpha(0.4);
    for (const row of rows) {
      const [icao24, callsign, , lon, lat, baro, geo, , , track] = row;
      next.add(icao24);
      const position = Cartesian3.fromDegrees(lon, lat, geo ?? baro ?? 0);
      const rotation = -CesiumMath.toRadians(track ?? 0);
      const existing = this.aircraftById.get(icao24);
      if (existing) {
        existing.row = row;
        existing.billboard.position = position;
        existing.billboard.rotation = rotation;
        existing.point.position = position;
        continue;
      }
      const id = { kind: "aircraft", id: icao24, label: callsign ?? icao24.toUpperCase() } satisfies PickInfo;
      const billboard = this.aircraft.add({
        position,
        image,
        width: 18,
        height: 18,
        rotation,
        alignedAxis: Cartesian3.UNIT_Z,
        scaleByDistance: new NearFarScalar(2e5, 1.3, 4e6, 0.8),
        distanceDisplayCondition: GlobeEngine.NEAR,
        id,
      });
      const point = this.aircraftPoints.add({
        position,
        pixelSize: 2,
        color: dot,
        distanceDisplayCondition: GlobeEngine.FAR,
        id,
      });
      this.aircraftById.set(icao24, { row, billboard, point });
    }
    for (const [id, entry] of this.aircraftById) {
      if (!next.has(id)) {
        this.aircraft.remove(entry.billboard);
        this.aircraftPoints.remove(entry.point);
        this.aircraftById.delete(id);
      }
    }
    this.applyAircraftFilter();
    if (this.selection?.kind === "aircraft") this.decorateSelection();
  }

  setAircraftFilter(filter: (row: AircraftRow) => boolean) {
    this.aircraftFilter = filter;
    this.applyAircraftFilter();
  }

  private applyAircraftFilter() {
    for (const { row, billboard, point } of this.aircraftById.values()) {
      const show = this.aircraftFilter(row);
      billboard.show = show;
      point.show = show;
    }
    this.render();
  }

  setAircraftVisible(show: boolean) {
    this.aircraft.show = show;
    this.aircraftPoints.show = show;
    this.render();
  }

  /** Draws the positions this server stored for the selected aircraft (oldest → newest). */
  showAircraftTrail(samples: { lon: number; lat: number; altitudeM: number | null }[]) {
    if (this.selection?.kind !== "aircraft") return;
    const entry = this.aircraftById.get(this.selection.id);
    if (!entry || samples.length < 1) return;
    const [, , , lon, lat, baro, geo] = entry.row;
    const points = [
      ...samples.map((s) => Cartesian3.fromDegrees(s.lon, s.lat, s.altitudeM ?? 0)),
      Cartesian3.fromDegrees(lon, lat, geo ?? baro ?? 0),
    ];
    this.addSelectionPath(points, DATA.selected, 0.75);
  }

  /* ───────────────────────────── Satellites ───────────────────────────── */

  setSatellites(tracks: SatelliteTrack[]) {
    this.satellites.removeAll();
    this.satelliteById.clear();
    const color = Color.fromCssColorString(DATA.satellite);
    const outline = Color.fromCssColorString("#04070c");
    for (const track of tracks) {
      const point = this.satellites.add({
        position: Cartesian3.ZERO,
        pixelSize: 4.5,
        color,
        outlineColor: outline,
        outlineWidth: 1.5,
        scaleByDistance: new NearFarScalar(1e6, 1.4, 6e7, 0.8),
        id: { kind: "satellite", id: track.noradId, label: track.name } satisfies PickInfo,
      });
      this.satelliteById.set(track.noradId, { track, point });
    }
    this.tickSatellites();
    this.applySatelliteFilter();
  }

  setSatelliteFilter(filter: (t: SatelliteTrack) => boolean) {
    this.satelliteFilter = filter;
    this.applySatelliteFilter();
  }

  private applySatelliteFilter() {
    for (const { track, point } of this.satelliteById.values()) point.show = this.satelliteFilter(track);
    this.render();
  }

  setSatellitesVisible(show: boolean) {
    this.satellites.show = show;
    if (show) this.startSatelliteClock();
    else this.stopSatelliteClock();
    this.render();
  }

  private startSatelliteClock() {
    if (this.satelliteTimer !== null) return;
    this.satelliteTimer = window.setInterval(() => this.tickSatellites(), 1000);
  }

  private stopSatelliteClock() {
    if (this.satelliteTimer !== null) window.clearInterval(this.satelliteTimer);
    this.satelliteTimer = null;
  }

  /** Propagates every visible satellite to now. A few hundred SGP4 calls: about a millisecond. */
  private tickSatellites() {
    if (document.hidden || !this.satellites.show) return;
    const now = new Date();
    for (const { track, point } of this.satelliteById.values()) {
      if (!point.show && this.selection?.id !== track.noradId) continue;
      const s = estimate(track, now);
      if (s) point.position = new Cartesian3(...s.ecef);
      else point.show = false;
    }
    this.render();
  }

  satelliteState(noradId: number, at = new Date()) {
    const entry = this.satelliteById.get(noradId);
    return entry ? estimate(entry.track, at) : null;
  }

  /* ───────────────────────────── Selection ───────────────────────────── */

  select(selection: Selection | null, fly = true) {
    this.selection = selection;
    this.lastFlightSeconds = 0;
    this.clearSelectionPaths();
    this.highlight();
    this.decorateSelection();
    if (selection && fly) this.flyToSelection(selection);
    if (selection) this.onFlight(this.lastFlightSeconds);
    this.render();
  }

  private highlight() {
    const selectedImage = aircraftMarker("selected");
    const airImage = aircraftMarker("air");
    const dot = Color.fromCssColorString(DATA.aircraft).withAlpha(0.4);
    const selectedDot = Color.fromCssColorString(DATA.selected);
    for (const [id, { billboard, point }] of this.aircraftById) {
      const isSelected = this.selection?.kind === "aircraft" && this.selection.id === id;
      billboard.image = isSelected ? selectedImage : airImage;
      point.color = isSelected ? selectedDot : dot;
      point.pixelSize = isSelected ? 6 : 2;
    }
    const satColor = Color.fromCssColorString(DATA.satellite);
    const selColor = Color.fromCssColorString(DATA.selected);
    for (const [id, { point }] of this.satelliteById) {
      const isSelected = this.selection?.kind === "satellite" && this.selection.id === id;
      point.color = isSelected ? selColor : satColor;
      point.pixelSize = isSelected ? 9 : 4.5;
    }
  }

  private decorateSelection() {
    this.clearSelectionPaths();
    const sel = this.selection;
    if (!sel) return;
    if (sel.kind === "event") {
      const event = this.eventById.get(sel.id)?.event;
      if (event && event.track.length > 1) {
        this.addSelectionPath(
          event.track.map((p) => Cartesian3.fromDegrees(p.lon, p.lat, 0)),
          DATA.selected,
          0.9,
        );
      }
    }
    if (sel.kind === "satellite") {
      const entry = this.satelliteById.get(sel.id);
      if (entry) {
        const points = orbitPath(entry.track, new Date()).map((p) => new Cartesian3(...p));
        if (points.length > 1) this.addSelectionPath(points, DATA.satellite, 0.8);
      }
    }
  }

  private addSelectionPath(points: Cartesian3[], css: string, alpha: number) {
    const line = this.paths.add({
      positions: points,
      width: 2,
      material: Material.fromType("Color", { color: Color.fromCssColorString(css).withAlpha(alpha) }),
    });
    this.selectionPaths.push(line);
    this.render();
  }

  private clearSelectionPaths() {
    for (const p of this.selectionPaths) this.paths.remove(p);
    this.selectionPaths = [];
  }

  private selectionPosition(): Cartesian3 | null {
    const sel = this.selection;
    if (!sel) return null;
    switch (sel.kind) {
      case "event": {
        const entry = this.eventById.get(sel.id);
        return entry && entry.billboard.show ? entry.billboard.position : null;
      }
      case "aircraft":
        return this.aircraftById.get(sel.id)?.billboard.position ?? null;
      case "satellite": {
        const p = this.satelliteById.get(sel.id)?.point;
        return p && !Cartesian3.equals(p.position, Cartesian3.ZERO) ? p.position : null;
      }
      case "place":
        return Cartesian3.fromDegrees(sel.lon, sel.lat, 0);
    }
  }

  private scratch = new Cartesian2();
  private lastScreen: string | null = null;

  private reportSelectionScreen() {
    const position = this.selectionPosition();
    let point: { x: number; y: number } | null = null;
    if (position && this.isVisible(position)) {
      const s = SceneTransforms.worldToWindowCoordinates(this.widget.scene, position, this.scratch);
      if (s) point = { x: s.x, y: s.y };
    }
    const key = point ? `${point.x.toFixed(1)},${point.y.toFixed(1)}` : null;
    if (key !== this.lastScreen) {
      this.lastScreen = key;
      this.onSelectionScreen(point);
    }
  }

  /** False when the point is behind the Earth from the camera's view. */
  private isVisible(position: Cartesian3) {
    const camera = this.widget.scene.camera.positionWC;
    const toPoint = Cartesian3.subtract(position, camera, new Cartesian3());
    const normal = Cartesian3.normalize(position, new Cartesian3());
    return Cartesian3.dot(toPoint, normal) < 0 || Cartesian3.magnitude(position) > 6_500_000;
  }

  /* ───────────────────────────── Camera ───────────────────────────── */

  private flyTo(lon: number, lat: number, height: number) {
    const destination = Cartesian3.fromDegrees(lon, lat, height);
    const camera = this.widget.scene.camera;
    if (this.options.reducedMotion) {
      camera.setView({ destination });
    } else {
      camera.flyTo({
        destination,
        duration: 1.6,
        easingFunction: EasingFunction.CUBIC_IN_OUT,
      });
      this.lastFlightSeconds = 1.6;
    }
    this.render();
  }

  private flyToSelection(sel: Selection) {
    const height = this.widget.scene.camera.positionCartographic.height;
    switch (sel.kind) {
      case "event": {
        const e = this.eventById.get(sel.id)?.event;
        if (e) this.flyTo(e.lon, e.lat, Math.min(height, e.track.length > 1 ? 4_500_000 : 2_200_000));
        break;
      }
      case "aircraft": {
        const r = this.aircraftById.get(sel.id)?.row;
        if (r) this.flyTo(r[3], r[4], Math.min(height, 900_000));
        break;
      }
      case "satellite": {
        const s = this.satelliteState(sel.id);
        if (s) this.flyTo(s.lon, s.lat, Math.max(s.altitudeKm * 1000 * 3.2, 9_000_000));
        break;
      }
      case "place":
        break;
    }
  }

  flyToPlace(lon: number, lat: number, height: number) {
    this.flyTo(lon, lat, height);
  }

  /** Height that fits the whole globe in the canvas, whatever its aspect ratio. */
  private homeHeight() {
    const { clientWidth: w, clientHeight: h } = this.widget.canvas;
    if (!w || !h) return 21_000_000;
    // Cesium's fov spans the larger canvas dimension; find the half-angle across the smaller one.
    const fov = (this.widget.scene.camera.frustum as { fov?: number }).fov ?? Math.PI / 3;
    const half = Math.atan(Math.tan(fov / 2) * (Math.min(w, h) / Math.max(w, h)));
    // The globe fills ~68% of the smaller dimension on wide screens, ~84% on phones.
    const share = w > h ? 0.68 : 0.84;
    const angular = Math.atan(share * Math.tan(half));
    const radius = 6_371_000;
    return radius / Math.sin(angular) - radius;
  }

  home(animate = true) {
    // Sub-solar longitude from the current UTC time; look 68 degrees east of it so day, the
    // terminator and night (with city lights) share the opening view.
    const now = new Date();
    const hours = now.getUTCHours() + now.getUTCMinutes() / 60;
    const subsolar = -(hours - 12) * 15;
    const lon = ((subsolar + 68 + 540) % 360) - 180;
    const destination = Cartesian3.fromDegrees(lon, 18, this.homeHeight());
    if (animate && !this.options.reducedMotion) {
      this.widget.scene.camera.flyTo({ destination, duration: 1.4, easingFunction: EasingFunction.CUBIC_IN_OUT });
    } else {
      this.widget.scene.camera.setView({ destination });
    }
    this.render();
  }

  zoom(direction: 1 | -1) {
    const camera = this.widget.scene.camera;
    const amount = camera.positionCartographic.height * 0.35;
    if (direction > 0) camera.zoomIn(amount);
    else camera.zoomOut(amount);
    this.render();
  }

  /* ───────────────────────────── Picking ───────────────────────────── */

  private pickAt(position: Cartesian2): PickInfo | null {
    const picked = this.widget.scene.pick(position, 12, 12) as { id?: PickInfo } | undefined;
    const id = picked?.id;
    return id && typeof id === "object" && "kind" in id ? id : null;
  }

  private handleClick(position: Cartesian2) {
    const info = this.pickAt(position);
    if (!info) {
      if (this.selection) {
        this.onSelect(null);
        return;
      }
      const cartesian = this.widget.scene.camera.pickEllipsoid(position);
      if (!cartesian) {
        this.onPickGround(null);
        return;
      }
      const carto = this.widget.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
      this.onPickGround({ lon: CesiumMath.toDegrees(carto.longitude), lat: CesiumMath.toDegrees(carto.latitude) });
      return;
    }
    const selection: Selection =
      info.kind === "satellite"
        ? { kind: "satellite", id: Number(info.id) }
        : info.kind === "aircraft"
          ? { kind: "aircraft", id: String(info.id) }
          : { kind: "event", id: String(info.id) };
    this.onSelect(selection);
  }

  private handleHover(position: Cartesian2) {
    const now = performance.now();
    if (now - this.hoverAt < 80) return;
    this.hoverAt = now;
    const info = this.pickAt(position);
    this.widget.canvas.style.cursor = info ? "pointer" : "";
    this.onHover(info ? { ...info, x: position.x, y: position.y } : null);
  }

  /* ───────────────────────────── Lifecycle ───────────────────────────── */

  resize() {
    this.widget.resize();
    this.refreshOcclusion();
    this.render();
  }

  destroy() {
    this.destroyed = true;
    this.stopSatelliteClock();
    if (this.lightingTimer !== null) window.clearInterval(this.lightingTimer);
    this.handler.destroy();
    this.widget.destroy();
  }
}

