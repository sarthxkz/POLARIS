"use client";

import "./cesium-base";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { useEffect, useRef, useState } from "react";
import { GlobeEngine } from "./engine";

interface GlobeProps {
  reducedMotion: boolean;
  lowPower: boolean;
  onReady: (engine: GlobeEngine | null) => void;
}

/**
 * Mounts the Cesium globe once. Everything after mount goes through the engine's methods, so
 * React re-renders never touch the WebGL scene.
 */
export default function Globe({ reducedMotion, lowPower, onReady }: GlobeProps) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  });

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let engine: GlobeEngine | null = null;
    try {
      engine = new GlobeEngine(el, { reducedMotion, lowPower });
      ready.current(engine);
    } catch (error) {
      console.error(error);
      // Reporting the failure of an external system (WebGL) that only this effect can start.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(
        error instanceof Error && /webgl/i.test(error.message)
          ? "This browser or device could not start WebGL, which the 3D globe needs."
          : "The 3D globe could not start on this device.",
      );
      ready.current(null);
    }
    const observer = new ResizeObserver(() => engine?.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      ready.current(null);
      engine?.destroy();
    };
  }, [reducedMotion, lowPower]);

  return (
    <div className="absolute inset-0">
      <div ref={container} className="absolute inset-0" aria-label="Interactive 3D globe" role="application" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="max-w-sm text-center">
            <p className="text-base text-ink">{failed}</p>
            <p className="mt-2 text-ink-soft">
              Every event, aircraft count and satellite is still listed on the{" "}
              <a className="text-ink underline" href="/events">
                events
              </a>{" "}
              and{" "}
              <a className="text-ink underline" href="/satellites">
                satellites
              </a>{" "}
              pages.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
