import { CATEGORY_COLOR, quakeColor } from "@/lib/palette";
import type { EventCategory } from "@/lib/types";
import { GLYPHS } from "@/components/globe/glyphs";

/** The category's marker as drawn on the globe: Lucide glyph in its data colour, or a quake disc. */
export function CategoryGlyph({
  category,
  size = 16,
  magnitude,
}: {
  category: EventCategory;
  size?: number;
  /** Earthquakes only: M6+ is drawn in the critical colour, as on the globe. */
  magnitude?: number | null;
}) {
  const color = category === "earthquakes" ? quakeColor(magnitude) : CATEGORY_COLOR[category];
  if (category === "earthquakes") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
        <circle cx="8" cy="8" r="5.5" fill={color} fillOpacity="0.38" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: GLYPHS[category as keyof typeof GLYPHS] ?? "" }}
    />
  );
}
