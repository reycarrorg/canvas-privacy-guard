// Copyright © 2026 Rolando Carreon. All rights reserved.

const EXACT_SYNTHETIC_ORIGINS = Object.freeze([
  "https://canvas.test.invalid",
  "https://optional.test.invalid",
]);

const CANVAS_CLOUD_SUFFIX = ".instructure.com";
export const CANVAS_CLOUD_OPTIONAL_PATTERN = "https://*.instructure.com/*";

function parseExactHttpsOrigin(value) {
  if (typeof value !== "string" || value.length > 253) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.port ||
      parsed.hostname.includes("*") ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeExactHttpsOrigin(value) {
  return parseExactHttpsOrigin(value)?.origin || null;
}

export function isPrototypeOrigin(value) {
  const normalized = normalizeExactHttpsOrigin(value);
  return normalized !== null && EXACT_SYNTHETIC_ORIGINS.includes(normalized);
}

export function isSupportedCanvasOrigin(value) {
  const parsed = parseExactHttpsOrigin(value);
  if (!parsed) return false;
  return (
    parsed.origin === EXACT_SYNTHETIC_ORIGINS[0] ||
    (parsed.hostname.endsWith(CANVAS_CLOUD_SUFFIX) && parsed.hostname !== CANVAS_CLOUD_SUFFIX.slice(1))
  );
}

export function supportedCanvasOriginFromUrl(value) {
  const origin = exactOriginFromUrl(value);
  return origin && isSupportedCanvasOrigin(origin) ? origin : null;
}

export function exactOriginFromUrl(value) {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function exactPermissionPattern(origin) {
  const normalized = normalizeExactHttpsOrigin(origin);
  return normalized ? `${normalized}/*` : null;
}

export function exactSupportedCanvasOriginFromPermissionPattern(value) {
  if (typeof value !== "string" || !value.endsWith("/*")) return null;
  const origin = normalizeExactHttpsOrigin(value.slice(0, -2));
  return origin !== null && isSupportedCanvasOrigin(origin) ? origin : null;
}

export function hasExactPermission(origin, permissionOrigins) {
  const expected = exactPermissionPattern(origin);
  return expected !== null && Array.isArray(permissionOrigins) && permissionOrigins.includes(expected);
}

export const PROTOTYPE_ORIGINS = EXACT_SYNTHETIC_ORIGINS;
