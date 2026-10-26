import {
  BillboardCollection,
  BoundingSphere,
  CallbackPositionProperty,
  HeadingPitchRange,
  Matrix3,
  Matrix4,
  Quaternion,
  Simon1994PlanetaryPositions,
  SunLight,
  TrackingReferenceFrame,
  Transforms,
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
  type Entity,
  type Label,
  type PointPrimitive,
  type Polyline,
} from "cesium";
import { aircraftMarker, eventImage, satelliteMarker } from "./markers";
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

/** Idle rotation: a full turn in about 3¾ minutes, west to east like the real planet. */
const ROTATE_RAD_PER_S = CesiumMath.toRadians(1.6);
/** Seconds without input before idle rotation eases back in. */
const IDLE_BEFORE_ROTATE_MS = 5_000;
/** Satellite trails: one sample every 15 s, 12 samples = the last three minutes. */
const TRAIL_STEP_MS = 15_000;
const TRAIL_SAMPLES = 12;
/** Well-known spacecraft that get a name label beside their point. */
const NAMED_SATELLITES: Record<number, string> = { 25544: "ISS", 48274: "Tiangong", 20580: "Hubble" };

interface SatEntry {
  track: SatelliteTrack;
  point: PointPrimitive;
  trail: Polyline;
  label: Label | null;
  /** Keyframe at the start of the current second, and one second later; drawn by interpolation. */
  a: Cartesian3;
  b: Cartesian3;
  /** Interpolated position this frame. */
  current: Cartesian3;
  history: Cartesian3[];
  lastHistory: number;
  valid: boolean;
}

const smoothstep = (x: number) => x * x * (3 - 2 * x);

/** Aircraft draw only when the camera is closer than this; the rail says so. */
export const AIRCRAFT_VISIBLE_WITHIN_M = 9_000_000;

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const naturalEarthCredit = new Credit(
  '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Borders and names: Natural Earth</a>',
);
const eoxCredit = new Credit(
  '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless 2024 by EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2024)',
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
  private satTrails = new PolylineCollection();
  private satLabels = new LabelCollection();
  private paths = new PolylineCollection();
  private borders = new PolylineCollection();
  private labels = new LabelCollection();
  private imagery: Partial<Record<ImageryKey, ImageryLayer>> = {};
  private eventById = new Map<string, { event: NaturalEvent; billboard: Billboard }>();
  private aircraftById = new Map<string, { row: AircraftRow; billboard: Billboard; point: PointPrimitive }>();
  private satelliteById = new Map<number, SatEntry>();
  private keyT0 = 0;
  private trailsOn = true;
  private autoRotate = false;
  private rotateRamp = 0;
  private lastInteraction = 0;
  private lastFrame = 0;
  private flying = false;
  private zoomRemaining = 0;
  private tracked: Entity | null = null;
  private introPending = true;
  private firstTilesTimer: number | null = null;
  /** Set by Face the Sun: idle rotation waits until the visitor touches the globe again. */
  private holdRotation = false;
  private sunScratch = new Cartesian3();
  private sunMatrix = new Matrix3();
  private aimScratch = [new Cartesian3(), new Cartesian3(), new Cartesian3(), new Cartesian3()];
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
  /** Fires once, when the first imagery tiles have drawn (so the page can fade the globe in). */
  onFirstTiles: () => void = () => {};
  /** Whether idle rotation is currently turning the globe. */
  onRotating: (rotating: boolean) => void = () => {};

  /** Replaces any of the callbacks above. */
  setHandlers(
    handlers: Partial<
      Pick<
        GlobeEngine,
        | "onSelect"
        | "onHover"
        | "onSelectionScreen"
        | "onCameraHeight"
        | "onPickGround"
        | "onFlight"
        | "onFirstTiles"
        | "onRotating"
      >
    >,
  ) {
    Object.assign(this, handlers);
  }

  constructor(container: HTMLElement, private options: EngineOptions) {
    // Sentinel-2 cloudless: a 10 m true-colour mosaic, sharp from whole-globe views down to cities.
    const base = new ImageryLayer(
      new UrlTemplateImageryProvider({
        url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
        tilingScheme: new WebMercatorTilingScheme(),
        maximumLevel: 14,
        credit: eoxCredit,
      }),
      { contrast: 1.08, saturation: 1.12 },
    );

    this.widget = new CesiumWidget(container, {
      baseLayer: base,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      // Full device resolution keeps the globe crisp on high-density screens; low-power trades it away.
      useBrowserRecommendedResolution: options.lowPower,
      scene3DOnly: true,
      msaaSamples: options.lowPower ? 1 : 4,
      showRenderLoopErrors: false,
      shouldAnimate: true,
      blurActiveElementOnCanvasFocus: false,
    });

    const { scene, clock } = this.widget;
    if (options.lowPower) {
      this.widget.resolutionScale = 0.8;
      this.widget.targetFrameRate = 30;
    } else {
      // Full device resolution, capped at 2x: HD on retina screens without a 9-16x pixel load on 3-4x phones.
      this.widget.resolutionScale = Math.min(1, 2 / (window.devicePixelRatio || 1));
    }

    const globe = scene.globe;
    globe.baseColor = Color.fromCssColorString("#0a1019");
    globe.enableLighting = true; // real terminator from the sun's position at the current time
    globe.dynamicAtmosphereLighting = true;
    globe.dynamicAtmosphereLightingFromSun = true;
    globe.vertexShadowDarkness = 0.5;
    globe.lightingFadeOutDistance = 0;
    globe.lightingFadeInDistance = 1;
    globe.lambertDiffuseMultiplier = 1.15;
    scene.light = new SunLight({ intensity: 2.4 });
    if (scene.sun) {
      scene.sun.show = true;
      scene.sun.glowFactor = 2.2;
    }
    scene.sunBloom = true;
    globe.showGroundAtmosphere = !options.lowPower;
    // A lower screen-space error loads finer tiles sooner: the HD look at every zoom.
    globe.maximumScreenSpaceError = options.lowPower ? 2.5 : 1;
    globe.tileCacheSize = options.lowPower ? 200 : 500;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
    scene.fog.enabled = true;
    scene.backgroundColor = Color.fromCssColorString("#04070c");
    if (scene.moon) scene.moon.show = false;

    const camera = scene.screenSpaceCameraController;
    camera.minimumZoomDistance = 2_000;
    camera.maximumZoomDistance = 45_000_000;
    // Softer inertia makes drags glide to a stop instead of halting.
    camera.inertiaSpin = options.reducedMotion ? 0 : 0.9;
    camera.inertiaTranslate = options.reducedMotion ? 0 : 0.9;
    camera.inertiaZoom = options.reducedMotion ? 0 : 0.8;

    clock.currentTime = JulianDate.now();

    scene.primitives.add(this.borders);
    scene.primitives.add(this.labels);
    scene.primitives.add(this.paths);
    scene.primitives.add(this.events);
    scene.primitives.add(this.satTrails);
    scene.primitives.add(this.satellites);
    scene.primitives.add(this.satLabels);
    scene.primitives.add(this.aircraftPoints);
    scene.primitives.add(this.aircraft);

    this.addImagery("nightLights", true);

    // Start further out; intro() brings the camera in once the first tiles have drawn.
    this.home(false, options.reducedMotion ? 1 : 2.3);

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

    // Any direct input pauses idle rotation; it eases back in after a few quiet seconds.
    const canvas = this.widget.canvas;
    const note = () => {
      this.lastInteraction = Date.now();
      this.holdRotation = false;
    };
    canvas.addEventListener("pointerdown", note);
    canvas.addEventListener("wheel", note, { passive: true });
    canvas.addEventListener("pointermove", (e) => {
      if (e.buttons) note();
    });

    clock.onTick.addEventListener(() => this.frame());

    const onProgress = (queued: number) => {
      if (queued > 0 || !this.introPending || this.destroyed) return;
      this.introPending = false;
      globe.tileLoadProgressEvent.removeEventListener(onProgress);
      this.onFirstTiles();
    };
    globe.tileLoadProgressEvent.addEventListener(onProgress);
    // A slow network should not keep the globe hidden.
    this.firstTilesTimer = window.setTimeout(() => onProgress(0), 4_000);
  }

  /* ───────────────────────────── Motion ───────────────────────────── */

  /** One-time arrival: the camera glides in from far out (rare, first-visit motion). */
  intro() {
    // A deep link may already be flying to (or following) something; the arrival must not override it.
    if (this.selection || this.tracked || this.flying) return;
    const destination = this.homeDestination(1);
    const camera = this.widget.scene.camera;
    if (this.options.reducedMotion) {
      camera.setView({ destination });
    } else {
      this.flying = true;
      camera.flyTo({
        destination,
        duration: 2.8,
        easingFunction: EasingFunction.QUARTIC_OUT,
        complete: () => this.endFlight(),
        cancel: () => this.endFlight(),
      });
    }
    this.render();
  }

  /** Unit vector from the Earth's centre toward the Sun, in the Earth-fixed frame, at the clock's time. */
  private sunDirection(result: Cartesian3) {
    const time = this.widget.clock.currentTime;
    const inertial = Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(time, this.sunScratch);
    const toFixed =
      Transforms.computeIcrfToFixedMatrix(time, this.sunMatrix) ??
      Transforms.computeTemeToPseudoFixedMatrix(time, this.sunMatrix);
    Matrix3.multiplyByVector(toFixed, inertial, result);
    return Cartesian3.normalize(result, result);
  }

  /** Half the camera's field of view across the screen's width. */
  private halfFovAcross() {
    const { clientWidth: w, clientHeight: h } = this.widget.canvas;
    const fov = (this.widget.scene.camera.frustum as { fov?: number }).fov ?? Math.PI / 3;
    return w >= h ? fov / 2 : Math.atan(Math.tan(fov / 2) * (w / Math.max(1, h)));
  }

  /** Turns `from` toward `to` by `angle` radians (both unit vectors). */
  private turnToward(from: Cartesian3, to: Cartesian3, angle: number, result: Cartesian3) {
    const axis = Cartesian3.cross(from, to, this.aimScratch[3]!);
    if (Cartesian3.magnitude(axis) < 1e-9 || angle === 0) return Cartesian3.clone(from, result);
    Cartesian3.normalize(axis, axis);
    const rotation = Matrix3.fromQuaternion(Quaternion.fromAxisAngle(axis, angle), new Matrix3());
    return Matrix3.multiplyByVector(rotation, from, result);
  }

  /**
   * While the globe turns, the camera's gaze leans gently toward the real Sun as it nears the
   * frame, so the Sun rises beside the Earth's limb instead of hiding just off-screen. The Earth
   * slides aside by at most 25 degrees; far from the Sun the gaze returns to the Earth's centre.
   */
  private aimTowardSun(blend: number) {
    const camera = this.widget.scene.camera;
    const [toCenter, sun, target] = this.aimScratch as [Cartesian3, Cartesian3, Cartesian3];
    Cartesian3.normalize(Cartesian3.negate(camera.positionWC, toCenter), toCenter);
    this.sunDirection(sun);
    const apart = Cartesian3.angleBetween(toCenter, sun);
    const half = this.halfFovAcross();
    const lean = CesiumMath.clamp(apart - 0.8 * half, 0, CesiumMath.toRadians(25));
    const fade = CesiumMath.clamp((half + CesiumMath.toRadians(30) - apart) / CesiumMath.toRadians(10), 0, 1);
    this.turnToward(toCenter, sun, lean * fade, target);
    const direction = Cartesian3.normalize(Cartesian3.lerp(camera.directionWC, target, blend, target), target);
    const up = Cartesian3.normalize(
      Cartesian3.subtract(
        Cartesian3.UNIT_Z,
        Cartesian3.multiplyByScalar(direction, Cartesian3.dot(direction, Cartesian3.UNIT_Z), new Cartesian3()),
        new Cartesian3(),
      ),
      new Cartesian3(),
    );
    camera.setView({ orientation: { direction, up } });
  }

  /**
   * Flies to where the real Sun stands just beyond the Earth's limb, its light falling on the
   * day-side crescent. The view then holds until the visitor moves the globe.
   */
  faceSun() {
    this.selection = null;
    this.stopTracking();
    this.clearSelectionPaths();
    this.highlight();
    const sun = this.sunDirection(new Cartesian3());
    // A direction perpendicular to the Sun, roughly along the equator.
    const side = Cartesian3.cross(Cartesian3.UNIT_Z, sun, new Cartesian3());
    if (Cartesian3.magnitude(side) < 1e-6) Cartesian3.clone(Cartesian3.UNIT_X, side);
    Cartesian3.normalize(side, side);
    // 140 degrees round from the Sun: mostly night side, with the sunlit crescent facing the Sun.
    const theta = CesiumMath.toRadians(140);
    const out = Cartesian3.normalize(
      Cartesian3.add(
        Cartesian3.multiplyByScalar(sun, Math.cos(theta), new Cartesian3()),
        Cartesian3.multiplyByScalar(side, Math.sin(theta), new Cartesian3()),
        new Cartesian3(),
      ),
      new Cartesian3(),
    );
    const destination = Cartesian3.multiplyByScalar(out, 6_371_000 * 4.7, new Cartesian3());
    const toCenter = Cartesian3.negate(out, new Cartesian3());
    const lean = Math.max(0, Cartesian3.angleBetween(toCenter, sun) - 0.8 * this.halfFovAcross());
    const direction = this.turnToward(toCenter, sun, lean, new Cartesian3());
    const { clientWidth: w, clientHeight: h } = this.widget.canvas;
    // Landscape: Sun beside the Earth; portrait: Sun above it.
    const upHint = w >= h ? Cartesian3.UNIT_Z : sun;
    const up = Cartesian3.normalize(
      Cartesian3.subtract(
        upHint,
        Cartesian3.multiplyByScalar(direction, Cartesian3.dot(direction, upHint), new Cartesian3()),
        new Cartesian3(),
      ),
      new Cartesian3(),
    );
    this.holdRotation = true;
    const camera = this.widget.scene.camera;
    if (this.options.reducedMotion) {
      camera.setView({ destination, orientation: { direction, up } });
    } else {
      this.flying = true;
      camera.flyTo({
        destination,
        orientation: { direction, up },
        duration: 2.6,
        easingFunction: EasingFunction.CUBIC_IN_OUT,
        complete: () => {
          this.flying = false;
        },
        cancel: () => {
          this.flying = false;
        },
      });
    }
    this.render();
  }

  setAutoRotate(on: boolean) {
    this.autoRotate = on && !this.options.reducedMotion;
    if (on) this.holdRotation = false;
    if (!this.autoRotate) this.rotateRamp = 0;
    this.render();
  }

  private endFlight() {
    this.flying = false;
    this.lastInteraction = Date.now();
  }

  /**
   * Runs every animation frame (Cesium clock tick). Rendering is on demand, so this asks for a
   * frame only while something is actually moving: rotation, a smooth zoom, a followed satellite,
   * or satellites seen up close.
   */
  private frame() {
    if (this.destroyed) return;
    const now = performance.now();
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    const camera = this.widget.scene.camera;
    let moving = false;

    if (Math.abs(this.zoomRemaining) > 50) {
      const step = this.zoomRemaining * Math.min(1, dt * 8);
      camera.zoomIn(step);
      this.zoomRemaining -= step;
      moving = true;
    }

    const idle = Date.now() - this.lastInteraction > IDLE_BEFORE_ROTATE_MS;
    const wantRotate =
      this.autoRotate && !this.selection && !this.tracked && !this.flying && !this.holdRotation && idle;
    const wasRotating = this.rotateRamp > 0;
    // Ease in over 1.5 s so rotation never starts with a jolt; stop at once when touched.
    this.rotateRamp = wantRotate ? Math.min(1, this.rotateRamp + dt / 1.5) : 0;
    if (this.rotateRamp > 0) {
      camera.rotate(Cartesian3.UNIT_Z, -ROTATE_RAD_PER_S * smoothstep(this.rotateRamp) * dt);
      this.aimTowardSun(Math.min(1, dt * 1.5));
      moving = true;
    }
    if (wasRotating !== this.rotateRamp > 0) this.onRotating(this.rotateRamp > 0);

    if (this.satellites.show && this.satelliteById.size > 0) {
      const close = camera.positionCartographic.height < 8_000_000;
      if (moving || close || this.tracked || this.selection?.kind === "satellite") {
        this.interpolateSatellites();
        moving = true;
      }
    }
    if (moving || this.tracked) this.render();
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
    const color = Color.fromCssColorString("#dce8f5").withAlpha(0.32);
    for (const flat of lines) {
      const positions = Cartesian3.fromDegreesArray(flat);
      // One material per line: Cesium destroys it with the line, so sharing one would double-destroy it.
      this.borders.add({ positions, width: 1, material: Material.fromType("Color", { color }) });
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
    if (this.tracked) this.stopTracking();
    this.satellites.removeAll();
    this.satTrails.removeAll();
    this.satLabels.removeAll();
    this.satelliteById.clear();
    const color = Color.fromCssColorString(DATA.satellite);
    const outline = Color.fromCssColorString("#04070c");
    const trailColor = color.withAlpha(0.32);
    const now = Date.now();
    for (const track of tracks) {
      const here = estimate(track, new Date(now));
      const next = estimate(track, new Date(now + 1000));
      const current = here ? new Cartesian3(...here.ecef) : new Cartesian3();
      // Seed the trail with the last three minutes so it is there from the first frame.
      const history: Cartesian3[] = [];
      for (let k = TRAIL_SAMPLES; k >= 1; k--) {
        const past = estimate(track, new Date(now - k * TRAIL_STEP_MS));
        if (past) history.push(new Cartesian3(...past.ecef));
      }
      const id = { kind: "satellite", id: track.noradId, label: track.name } satisfies PickInfo;
      const point = this.satellites.add({
        position: current,
        pixelSize: 5,
        color,
        outlineColor: outline,
        outlineWidth: 1.5,
        scaleByDistance: new NearFarScalar(1e6, 1.5, 6e7, 0.8),
        show: here !== null,
        id,
      });
      const trail = this.satTrails.add({
        positions: here ? [...history, current] : [],
        width: 1.5,
        // One material per trail: Cesium destroys it with the polyline (see setBorders).
        material: Material.fromType("Color", { color: trailColor }),
        show: here !== null && this.trailsOn,
        id,
      });
      const name = NAMED_SATELLITES[track.noradId];
      const label = name
        ? this.satLabels.add({
            position: current,
            text: name,
            font: "500 12px sans-serif",
            fillColor: color,
            outlineColor: outline,
            outlineWidth: 3,
            style: LabelStyle.FILL_AND_OUTLINE,
            horizontalOrigin: HorizontalOrigin.LEFT,
            verticalOrigin: VerticalOrigin.CENTER,
            pixelOffset: new Cartesian2(9, 0),
            show: here !== null,
          })
        : null;
      this.satelliteById.set(track.noradId, {
        track,
        point,
        trail,
        label,
        a: Cartesian3.clone(current),
        b: next ? new Cartesian3(...next.ecef) : Cartesian3.clone(current),
        current,
        history,
        lastHistory: now,
        valid: here !== null,
      });
    }
    this.keyT0 = now;
    this.applySatelliteFilter();
  }

  /** Font for the spacecraft name labels, matched to the interface. */
  setSatelliteLabelFont(font: string) {
    this.satLabels.removeAll();
    for (const entry of this.satelliteById.values()) {
      const name = NAMED_SATELLITES[entry.track.noradId];
      if (!name) continue;
      entry.label = this.satLabels.add({
        position: entry.current,
        text: name,
        font: `500 12px ${font}`,
        fillColor: Color.fromCssColorString(DATA.satellite),
        outlineColor: Color.fromCssColorString("#04070c"),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.CENTER,
        pixelOffset: new Cartesian2(9, 0),
        show: entry.point.show,
      });
    }
    this.render();
  }

  setSatelliteFilter(filter: (t: SatelliteTrack) => boolean) {
    this.satelliteFilter = filter;
    this.applySatelliteFilter();
  }

  private applySatelliteFilter() {
    const trackedId = this.tracked ? this.selectedSatelliteId() : null;
    for (const entry of this.satelliteById.values()) {
      const show = entry.valid && this.satelliteFilter(entry.track);
      // The followed satellite is drawn by its icon instead of its point.
      entry.point.show = show && entry.track.noradId !== trackedId;
      entry.trail.show = show && this.trailsOn;
      if (entry.label) entry.label.show = show && entry.track.noradId !== trackedId;
    }
    this.render();
  }

  setSatelliteTrails(on: boolean) {
    this.trailsOn = on;
    this.applySatelliteFilter();
  }

  setSatellitesVisible(show: boolean) {
    this.satellites.show = show;
    this.satTrails.show = show;
    this.satLabels.show = show;
    if (show) this.startSatelliteClock();
    else this.stopSatelliteClock();
    this.render();
  }

  private startSatelliteClock() {
    if (this.satelliteTimer !== null) return;
    this.satelliteTimer = window.setInterval(() => this.keyframe(), 1000);
  }

  private stopSatelliteClock() {
    if (this.satelliteTimer !== null) window.clearInterval(this.satelliteTimer);
    this.satelliteTimer = null;
  }

  private selectedSatelliteId() {
    return this.selection?.kind === "satellite" ? this.selection.id : null;
  }

  private interpScratch = new Cartesian3();

  /** Places every satellite between its two keyframes; cheap enough for every frame. */
  private interpolateSatellites() {
    const f = Math.min(1.25, Math.max(0, (Date.now() - this.keyT0) / 1000));
    const selected = this.selectedSatelliteId();
    for (const entry of this.satelliteById.values()) {
      if (!entry.valid) continue;
      if (!entry.point.show && entry.track.noradId !== selected) continue;
      Cartesian3.lerp(entry.a, entry.b, f, entry.current);
      entry.point.position = entry.current;
      if (entry.label) entry.label.position = entry.current;
    }
  }

  /**
   * Once a second: a fresh SGP4 keyframe one second ahead for every shown satellite (a few
   * hundred calls, about a millisecond), and the trail grows by a sample every 15 s.
   */
  private keyframe() {
    if (document.hidden || !this.satellites.show) return;
    this.interpolateSatellites();
    const now = Date.now();
    const ahead = new Date(now + 1000);
    const selected = this.selectedSatelliteId();
    for (const entry of this.satelliteById.values()) {
      if (!entry.valid) continue;
      const visible = entry.point.show || entry.track.noradId === selected;
      if (!visible && !entry.trail.show) continue;
      Cartesian3.clone(entry.current, entry.a);
      const next = estimate(entry.track, ahead);
      if (!next) {
        entry.valid = false;
        entry.point.show = false;
        entry.trail.show = false;
        if (entry.label) entry.label.show = false;
        continue;
      }
      entry.b.x = next.ecef[0];
      entry.b.y = next.ecef[1];
      entry.b.z = next.ecef[2];
      if (now - entry.lastHistory >= TRAIL_STEP_MS) {
        entry.history.push(Cartesian3.clone(entry.current));
        if (entry.history.length > TRAIL_SAMPLES) entry.history.shift();
        entry.lastHistory = now;
      }
      if (entry.trail.show) entry.trail.positions = [...entry.history, Cartesian3.clone(entry.current)];
    }
    this.keyT0 = now;
    this.interpolateSatellites();
    this.render();
  }

  satelliteState(noradId: number, at = new Date()) {
    const entry = this.satelliteById.get(noradId);
    return entry ? estimate(entry.track, at) : null;
  }

  /* ─────────────────────── Following a satellite ─────────────────────── */

  /**
   * Flies out beside the satellite (aimed at where it will be when the flight lands), then
   * hands the camera to Cesium's entity tracking so it keeps following, and the visitor can
   * still orbit and zoom around it.
   */
  private followSatellite(id: number) {
    const entry = this.satelliteById.get(id);
    if (!entry) return;
    this.stopTracking();
    const duration = this.options.reducedMotion ? 0 : 2.4;
    const at = estimate(entry.track, new Date(Date.now() + duration * 1000));
    if (!at) return;
    const altitude = at.altitudeKm * 1000;
    const range = Math.min(12_000_000, Math.max(900_000, altitude * 3));
    const pitch = CesiumMath.toRadians(-22);

    const current = entry.current;
    const entity = this.widget.entities.add({
      position: new CallbackPositionProperty((_time, result) => Cartesian3.clone(current, result), false),
      billboard: { image: satelliteMarker(), width: 30, height: 30 },
      trackingReferenceFrame: TrackingReferenceFrame.ENU,
      // Same offset the flight ends at (south of and above the satellite, in its east-north-up frame).
      viewFrom: new Cartesian3(0, -range * Math.cos(pitch), -range * Math.sin(pitch)),
    });
    this.tracked = entity;
    this.applySatelliteFilter();

    const startFollowing = () => {
      this.endFlight();
      if (this.tracked !== entity) return;
      this.widget.trackedEntity = entity;
    };
    if (duration === 0) {
      startFollowing();
      return;
    }
    this.flying = true;
    this.lastFlightSeconds = duration;
    this.widget.scene.camera.flyToBoundingSphere(new BoundingSphere(new Cartesian3(...at.ecef), 1), {
      offset: new HeadingPitchRange(0, pitch, range),
      duration,
      easingFunction: EasingFunction.CUBIC_IN_OUT,
      complete: startFollowing,
      cancel: () => this.endFlight(),
    });
  }

  private stopTracking() {
    if (!this.tracked) return;
    this.widget.trackedEntity = undefined;
    this.widget.entities.remove(this.tracked);
    this.tracked = null;
    this.widget.scene.camera.lookAtTransform(Matrix4.IDENTITY);
    this.applySatelliteFilter();
  }

  /** After following a satellite, glide back out to a whole-globe view over the same place. */
  private returnToGlobe() {
    const carto = this.widget.scene.camera.positionCartographic;
    const destination = Cartesian3.fromRadians(carto.longitude, Math.max(-1.1, Math.min(1.1, carto.latitude)), this.homeHeight());
    if (this.options.reducedMotion) {
      this.widget.scene.camera.setView({ destination });
      return;
    }
    this.flying = true;
    this.widget.scene.camera.flyTo({
      destination,
      duration: 1.8,
      easingFunction: EasingFunction.CUBIC_IN_OUT,
      complete: () => this.endFlight(),
      cancel: () => this.endFlight(),
    });
  }

  /* ───────────────────────────── Selection ───────────────────────────── */

  select(selection: Selection | null, fly = true) {
    const wasFollowing = this.tracked !== null;
    if (wasFollowing && !(selection?.kind === "satellite")) {
      this.stopTracking();
      if (!selection) this.returnToGlobe();
    }
    this.selection = selection;
    this.lastFlightSeconds = 0;
    this.lastInteraction = Date.now();
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
      point.pixelSize = isSelected ? 9 : 5;
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
        const entry = this.satelliteById.get(sel.id);
        return entry?.valid ? entry.current : null;
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
      this.flying = true;
      camera.flyTo({
        destination,
        duration: 1.6,
        easingFunction: EasingFunction.CUBIC_IN_OUT,
        complete: () => this.endFlight(),
        cancel: () => this.endFlight(),
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
      case "satellite":
        this.followSatellite(sel.id);
        break;
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

  private homeDestination(distanceFactor: number) {
    // Sub-solar longitude from the current UTC time; look 68 degrees east of it so day, the
    // terminator and night (with city lights) share the opening view.
    const now = new Date();
    const hours = now.getUTCHours() + now.getUTCMinutes() / 60;
    const subsolar = -(hours - 12) * 15;
    const lon = ((subsolar + 68 + 540) % 360) - 180;
    return Cartesian3.fromDegrees(lon, 18, this.homeHeight() * distanceFactor);
  }

  home(animate = true, distanceFactor = 1) {
    if (this.tracked) this.stopTracking();
    const destination = this.homeDestination(distanceFactor);
    if (animate && !this.options.reducedMotion) {
      this.flying = true;
      this.widget.scene.camera.flyTo({
        destination,
        duration: 1.6,
        easingFunction: EasingFunction.CUBIC_IN_OUT,
        complete: () => this.endFlight(),
        cancel: () => this.endFlight(),
      });
    } else {
      this.widget.scene.camera.setView({ destination });
    }
    this.render();
  }

  /** Zoom buttons glide: the step is spent over a few frames instead of jumping. */
  zoom(direction: 1 | -1) {
    const camera = this.widget.scene.camera;
    const amount = camera.positionCartographic.height * 0.4;
    this.lastInteraction = Date.now();
    if (this.options.reducedMotion) {
      if (direction > 0) camera.zoomIn(amount);
      else camera.zoomOut(amount);
    } else {
      this.zoomRemaining += direction > 0 ? amount : -amount;
    }
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
    if (this.firstTilesTimer !== null) window.clearTimeout(this.firstTilesTimer);
    this.stopTracking();
    this.stopSatelliteClock();
    if (this.lightingTimer !== null) window.clearInterval(this.lightingTimer);
    this.handler.destroy();
    this.widget.destroy();
  }
}

