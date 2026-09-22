type Props = Record<string, string | number | boolean | null | undefined>;

/**
 * Product analytics shim. Events describe utility only - never artwork geometry.
 * Wire a real provider here; until then events are visible in the console when
 * `localStorage.blendyDebug` is set.
 */
export function track(event: string, props: Props = {}) {
  try {
    if (localStorage.getItem("blendyDebug")) {
      // eslint-disable-next-line no-console
      console.info("[blendy]", event, props);
    }
  } catch {
    /* ignore */
  }
}
