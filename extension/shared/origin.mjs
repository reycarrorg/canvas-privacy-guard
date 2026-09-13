// Copyright © 2026 Rolando Carreon. All rights reserved.

const EXACT_SYNTHETIC_ORIGINS = Object.freeze([
  "https://canvas.test.invalid",
  "https://optional.test.invalid",
]);

export function normalizeExactHttpsOrigin(value) {
  if (typeof value !== "string" || value.length > 253) return null;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname.includes("*") ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return EXACT_SYNTHETIC_ORIGINS.includes(parsed.origin) ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function isPrototypeOrigin(value) {
  const normalized = normalizeExactHttpsOrigin(value);
  return normalized !== null && EXACT_SYNTHETIC_ORIGINS.includes(normalized);
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

export function hasExactPermission(origin, permissionOrigins) {
  const expected = exactPermissionPattern(origin);
  return expected !== null && Array.isArray(permissionOrigins) && permissionOrigins.includes(expected);
}

export const PROTOTYPE_ORIGINS = EXACT_SYNTHETIC_ORIGINS;
