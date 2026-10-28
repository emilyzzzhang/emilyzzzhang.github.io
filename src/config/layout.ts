/** Below this width panels become bottom sheets and the camera reframes for portrait. */
export const MOBILE_BREAKPOINT = 768;

export const PANEL_GUTTER = 24;

/** Share of the viewport a side panel takes: half by default, so the room stays visible beside it. */
export const PANEL_VIEWPORT_FRACTION = 0.5;

/** Share of the viewport a panel takes while the visitor has it expanded. */
export const PANEL_EXPANDED_VIEWPORT_FRACTION = 0.75;

/**
 * Rendered width of a side panel; the camera uses it to keep the focused object visible beside
 * the panel. Mirrors the `.panel` and `.panel--expanded` width rules in styles/ui.css.
 */
export function panelWidth(viewportWidth: number, expanded = false): number {
  const fraction = expanded ? PANEL_EXPANDED_VIEWPORT_FRACTION : PANEL_VIEWPORT_FRACTION;
  return Math.min(viewportWidth * fraction - PANEL_GUTTER, viewportWidth - PANEL_GUTTER * 2);
}

/** Pointer travel (px) above which a press counts as a drag, not a click on an object. */
export const CLICK_DRAG_TOLERANCE = 6;
