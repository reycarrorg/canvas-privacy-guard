// Copyright © 2026 Rolando Carreon. All rights reserved.

import {
  CLASSIFIER_REVISION,
  DESTINATION_CLASSES,
  INITIATOR_RELATIONS,
  METHOD_CLASSES,
  NETWORK_ACTION,
  PATH_CLASSES,
  RESOURCE_TYPES,
  STATES,
} from "./constants.mjs";

const INPUT_KEYS = Object.freeze([
  "classifierRevision",
  "destinationClass",
  "initiatorRelation",
  "lifecycleState",
  "methodClass",
  "pathClass",
  "resourceType",
]);

function result(eventClass, observationAction, reasonCode, suspendObservation = false) {
  return Object.freeze({
    eventClass,
    networkAction: NETWORK_ACTION,
    observationAction,
    reasonCode,
    suspendObservation,
    futureRule: null,
  });
}

function closedInput(input) {
  return (
    input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    JSON.stringify(Object.keys(input).sort()) === JSON.stringify(INPUT_KEYS) &&
    DESTINATION_CLASSES.includes(input.destinationClass) &&
    PATH_CLASSES.includes(input.pathClass) &&
    RESOURCE_TYPES.includes(input.resourceType) &&
    METHOD_CLASSES.includes(input.methodClass) &&
    INITIATOR_RELATIONS.includes(input.initiatorRelation) &&
    STATES.includes(input.lifecycleState) &&
    input.classifierRevision === CLASSIFIER_REVISION
  );
}

export function classifyRedacted(input, localEvidence = Object.freeze({ optionalCandidateAccepted: false })) {
  if (!closedInput(input)) return result("unknown", "SKIP", "INVALID_OR_STALE_INPUT");
  if (input.lifecycleState !== "ACTIVE_OBSERVE") {
    const assessment = input.lifecycleState === "ASSESSMENT_SAFE";
    return result(
      assessment ? "assessment" : "unknown",
      "SKIP",
      assessment ? "ASSESSMENT_STATE_DOMINATES" : "OBSERVATION_INACTIVE",
      assessment,
    );
  }
  if (
    input.pathClass === "assessment_suspected" ||
    input.initiatorRelation === "enrolled_child_frame"
  ) {
    return result("assessment", "REDACTED_RECORD", "ASSESSMENT_EVIDENCE", true);
  }
  if (
    input.pathClass === "authentication" ||
    input.destinationClass === "identity_provider_transit" ||
    input.initiatorRelation === "sso_transit"
  ) {
    return result("authentication_sso", "REDACTED_RECORD", "AUTHENTICATION_PROTECTED");
  }
  if (input.pathClass === "autosave_or_submission") {
    return result("autosave_submission", "REDACTED_RECORD", "SAVE_SUBMISSION_PROTECTED");
  }
  if (input.pathClass === "security") {
    return result("security", "REDACTED_RECORD", "SECURITY_PROTECTED");
  }
  if (
    input.pathClass === "static_asset" ||
    input.pathClass === "course_or_navigation" ||
    input.destinationClass === "external_tool"
  ) {
    return result("essential", "REDACTED_RECORD", "ESSENTIAL_FLOW");
  }
  if (
    input.destinationClass === "separate_third_party" &&
    input.pathClass === "optional_candidate" &&
    input.initiatorRelation === "enrolled_top_level" &&
    localEvidence.optionalCandidateAccepted === true
  ) {
    return result("optional_separable", "REDACTED_RECORD", "SYNTHETIC_OPTIONAL_EVIDENCE");
  }
  return result("unknown", "REDACTED_RECORD", "UNKNOWN_ALLOW");
}
