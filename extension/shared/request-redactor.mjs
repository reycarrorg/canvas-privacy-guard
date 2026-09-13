// Copyright © 2026 Rolando Carreon. All rights reserved.

import {
  CLASSIFIER_REVISION,
  DESTINATION_CLASSES,
  INITIATOR_RELATIONS,
  METHOD_CLASSES,
  PATH_CLASSES,
  RESOURCE_TYPES,
} from "./constants.mjs";
import { exactOriginFromUrl } from "./origin.mjs";

const STATIC_SUFFIX = /\.(?:css|js|mjs|png|jpg|jpeg|gif|svg|webp|woff2?|ttf)$/i;

export function pathClassFromUrl(parsed, destinationClass) {
  const path = parsed.pathname.toLowerCase();
  if (destinationClass === "separate_third_party") {
    return path === "/collect" ? "optional_candidate" : "unknown";
  }
  if (/\/(?:quiz|quizzes|assessment|assessments|attempt|attempts|answer|answers|timer|focus|visibility|batch|batched)(?:\/|$)/.test(path)) {
    return "assessment_suspected";
  }
  if (/\/(?:login|logout|oauth|authorize|session)(?:\/|$)/.test(path)) {
    return "authentication";
  }
  if (/\/(?:save|autosave|submit|submission|confirm|receipt)(?:\/|$)/.test(path)) {
    return "autosave_or_submission";
  }
  if (/\/(?:csrf|security|integrity|rate-limit)(?:\/|$)/.test(path)) {
    return "security";
  }
  if (STATIC_SUFFIX.test(path)) return "static_asset";
  if (path === "/" || /\/(?:course|courses|files|media|navigation|lti|accessibility)(?:\/|$)/.test(path)) {
    return "course_or_navigation";
  }
  return "unknown";
}

function coarseResource(value) {
  if (RESOURCE_TYPES.includes(value)) return value;
  if (value === "xmlhttprequest") return "xhr";
  if (value === "main_frame") return "document";
  return "unknown";
}

function coarseMethod(value) {
  if (typeof value !== "string") return "unknown";
  const method = value.toUpperCase();
  if (method === "GET" || method === "HEAD") return "read";
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) return "state_changing";
  if (method === "OPTIONS") return "other";
  return "unknown";
}

export function minimizeRawRequest(rawEvent, context) {
  if (!rawEvent || typeof rawEvent !== "object" || rawEvent.incognito === true) return null;
  if (
    !context ||
    context.active !== true ||
    context.recognizedSurface !== true ||
    typeof context.canvasOrigin !== "string"
  ) return null;

  try {
    const parsed = new URL(typeof rawEvent.url === "string" ? rawEvent.url : "");
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;

    let destinationClass = "unknown";
    if (parsed.origin === context.canvasOrigin) {
      destinationClass = "enrolled_canvas_origin";
    } else if (parsed.origin === context.optionalOrigin) {
      destinationClass = "separate_third_party";
    } else if (parsed.origin === context.identityOrigin) {
      // Identity traffic is deliberately dropped before classification or storage.
      return null;
    } else {
      return null;
    }

    const initiatorOrigin = exactOriginFromUrl(rawEvent.initiator || rawEvent.originUrl || "");
    const initiatorRelation = initiatorOrigin === context.canvasOrigin
      ? (rawEvent.parentFrameId >= 0 ? "enrolled_child_frame" : "enrolled_top_level")
      : "unknown";
    if (initiatorRelation === "unknown") return null;

    return Object.freeze({
      destinationClass,
      pathClass: pathClassFromUrl(parsed, destinationClass),
      resourceType: coarseResource(rawEvent.type),
      methodClass: coarseMethod(rawEvent.method),
      initiatorRelation,
      lifecycleState: context.lifecycleState,
      classifierRevision: CLASSIFIER_REVISION,
    });
  } catch {
    return null;
  }
}

export function isClosedRedactedInput(value) {
  return Boolean(
    value &&
    DESTINATION_CLASSES.includes(value.destinationClass) &&
    PATH_CLASSES.includes(value.pathClass) &&
    RESOURCE_TYPES.includes(value.resourceType) &&
    METHOD_CLASSES.includes(value.methodClass) &&
    INITIATOR_RELATIONS.includes(value.initiatorRelation) &&
    value.classifierRevision === CLASSIFIER_REVISION,
  );
}
