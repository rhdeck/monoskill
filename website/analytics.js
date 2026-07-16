const ANALYTICS_ENDPOINT = "https://plausible.io/api/event";
const ANALYTICS_DOMAIN = "monoskill.com";
const ALLOWED_EVENTS = new Set(["source_input_completed", "copy_cli", "copy_ai_prompt"]);
const ALLOWED_SOURCE_TYPES = new Set(["github-shorthand", "git-url", "local-path"]);

/** Build the complete allowlisted Plausible payload without query, hash, source, or name values. */
export function makeAnalyticsPayload(event, detail, location) {
  if (!ALLOWED_EVENTS.has(event)) throw new Error("Unsupported analytics event.");
  const props = {};
  if (ALLOWED_SOURCE_TYPES.has(detail?.source_type)) props.source_type = detail.source_type;
  return {
    domain: ANALYTICS_DOMAIN,
    name: event,
    url: `https://${ANALYTICS_DOMAIN}${location.pathname || "/"}`,
    ...(Object.keys(props).length ? { props } : {})
  };
}

/** Send only on the canonical production host, keeping local previews and pasted values off the wire. */
export function collectAnalytics(event, detail, location = window.location, beacon = navigator.sendBeacon.bind(navigator)) {
  if (location.hostname !== ANALYTICS_DOMAIN) return false;
  const payload = makeAnalyticsPayload(event, detail, location);
  return beacon(ANALYTICS_ENDPOINT, new Blob([JSON.stringify(payload)], { type: "text/plain" }));
}
