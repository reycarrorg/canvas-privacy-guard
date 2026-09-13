#!/usr/bin/env node
// Copyright © 2026 Rolando Carreon. All rights reserved.

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { createObservationAdapter } from "../../extension/shared/browser-adapter.mjs";
import { makeFakeBrowser, flushAsyncWork } from "./fake-browser.mjs";

const FIXED_NOW = Date.parse("2026-01-01T12:07:39Z");

export const SYNTHETIC_FLOWS = Object.freeze([
  ["login", "/login", "document", "POST"],
  ["navigation", "/courses/synthetic", "document", "GET"],
  ["files", "/files/synthetic", "other", "GET"],
  ["media", "/media/synthetic", "media", "GET"],
  ["accessibility", "/accessibility/synthetic", "stylesheet", "GET"],
  ["sso", "https://idp.test.invalid/synthetic", "document", "GET"],
  ["lti", "/lti/synthetic", "sub_frame", "GET"],
  ["autosave", "/autosave", "xhr", "POST"],
  ["timer", "/timer", "fetch", "POST"],
  ["answer", "/answer", "xhr", "POST"],
  ["submission", "/submit", "fetch", "POST"],
  ["confirmation", "/confirm", "document", "GET"],
  ["security", "/security", "xhr", "POST"],
  ["focus", "/focus", "beacon", "POST"],
  ["visibility", "/visibility", "beacon", "POST"],
  ["batched", "/batch", "fetch", "POST"],
  ["beacon", "https://optional.test.invalid/collect", "beacon", "POST"],
  ["fetch", "https://optional.test.invalid/collect", "fetch", "POST"],
  ["xhr", "https://optional.test.invalid/collect", "xmlhttprequest", "POST"],
  ["websocket", "wss://canvas.test.invalid/socket", "websocket", "GET"],
  ["worker", "/assets/synthetic-worker.mjs", "script", "GET"],
  ["cache", "/assets/synthetic-cache.js", "script", "GET"],
  ["retry", "/save", "xhr", "POST"],
  ["failure", "/unknown/failure", "other", "OPTIONS"],
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function destination(value) {
  return value.startsWith("https://") || value.startsWith("wss://")
    ? value
    : `https://canvas.test.invalid${value}`;
}

function networkReceipt([name], ordinal) {
  const requestBytes = Buffer.from(`request:${name}:synthetic-bytes`, "utf8");
  const responseBytes = Buffer.from(`response:${name}:synthetic-bytes`, "utf8");
  return {
    ordinal,
    flow: name,
    requestSha256: sha256(requestBytes),
    responseSha256: sha256(responseBytes),
    requestLength: requestBytes.length,
    responseLength: responseBytes.length,
    delivered: true,
  };
}

export async function runSyntheticHarness() {
  const disabledReceipts = SYNTHETIC_FLOWS.map(networkReceipt);
  const enabledReceipts = [];
  const stateReceipts = [];
  const listenerReturns = [];
  let forbiddenCanaryFound = false;

  for (const [ordinal, flow] of SYNTHETIC_FLOWS.entries()) {
    const browser = makeFakeBrowser();
    const adapter = createObservationAdapter(browser, "synthetic", {
      now: () => FIXED_NOW,
      monotonic: () => 100 + ordinal,
    });
    await adapter.start();
    const [, rawDestination, type, method] = flow;
    const results = browser.webRequest.onBeforeRequest.emitSync({
      url: `${destination(rawDestination)}?FORBIDDEN_CANARY_QUERY_91d7#FORBIDDEN_CANARY_FRAGMENT_91d7`,
      initiator: "https://canvas.test.invalid/courses/synthetic",
      method,
      type,
      tabId: 1,
      parentFrameId: -1,
      incognito: false,
    });
    listenerReturns.push(...results);
    enabledReceipts.push(networkReceipt(flow, ordinal));
    await flushAsyncWork();
    const persisted = JSON.stringify(browser.storage.local.data.gate2Activity || []);
    forbiddenCanaryFound ||= persisted.includes("FORBIDDEN_CANARY_");
    stateReceipts.push({ flow: flow[0], state: adapter.getState().state, networkAction: adapter.getState().networkAction });
  }

  const disabledCanonical = `${JSON.stringify(disabledReceipts)}\n`;
  const enabledCanonical = `${JSON.stringify(enabledReceipts)}\n`;
  const evidence = {
    schemaVersion: 1,
    harness: "fake-browser-real-adapter-core-ui-model-path",
    fixtureNetwork: "in-memory-only",
    flowCount: SYNTHETIC_FLOWS.length,
    disabledReceiptSha256: sha256(disabledCanonical),
    enabledReceiptSha256: sha256(enabledCanonical),
    receiptsByteEquivalent: disabledCanonical === enabledCanonical,
    listenerAlwaysReturnedUndefined: listenerReturns.every((value) => value === undefined),
    forbiddenCanaryFound,
    everyStateAllows: stateReceipts.every((receipt) => receipt.networkAction === "ALLOW"),
    stateReceipts,
  };
  return evidence;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const evidence = await runSyntheticHarness();
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  if (
    !evidence.receiptsByteEquivalent ||
    !evidence.listenerAlwaysReturnedUndefined ||
    evidence.forbiddenCanaryFound ||
    !evidence.everyStateAllows
  ) process.exitCode = 1;
}
