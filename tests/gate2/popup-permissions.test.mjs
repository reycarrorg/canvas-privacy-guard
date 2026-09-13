// Copyright © 2026 Rolando Carreon. All rights reserved.

import assert from "node:assert/strict";
import test from "node:test";

import { createObservationAdapter } from "../../extension/shared/browser-adapter.mjs";
import {
  removeCanvasOriginAccess,
  switchCanvasOriginAccess,
} from "../../extension/ui/popup.mjs";
import { makeFakeBrowser } from "./fake-browser.mjs";

const FIXED_NOW = Date.parse("2026-01-01T12:07:39Z");
const ALPHA = "https://alpha-university.instructure.com";
const BETA = "https://beta-university.instructure.com";
const OPTIONAL = "https://optional.test.invalid/*";

async function enrolledHarness() {
  const browser = makeFakeBrowser({
    settings: { schemaVersion: 1, disabled: false, enrolledOrigins: [ALPHA] },
    permissions: [`${ALPHA}/*`, OPTIONAL],
    tabs: [{
      id: 1,
      windowId: 1,
      incognito: false,
      url: `${ALPHA}/courses/synthetic`,
    }],
  });
  const adapter = createObservationAdapter(browser, "synthetic", {
    now: () => FIXED_NOW,
    monotonic: () => 100,
  });
  await adapter.start();
  return { browser, adapter };
}

function runtimeFor(adapter, calls = []) {
  return {
    sendMessage: async (message) => {
      calls.push(`message:${message.command}`);
      return adapter.handleMessage(message);
    },
  };
}

test("popup transaction switches alpha to beta and revokes alpha only after commit", async () => {
  const { browser, adapter } = await enrolledHarness();
  const calls = [];
  const originalRequest = browser.permissions.request.bind(browser.permissions);
  const originalRemove = browser.permissions.remove.bind(browser.permissions);
  browser.permissions.request = async (details) => {
    assert.deepEqual(browser.storage.local.data.gate2Settings.enrolledOrigins, [ALPHA]);
    assert.equal(browser.permissions.origins.includes(`${ALPHA}/*`), true);
    calls.push(`request:${details.origins[0]}`);
    return originalRequest(details);
  };
  browser.permissions.remove = async (details) => {
    if (details.origins.includes(`${ALPHA}/*`)) {
      assert.deepEqual(browser.storage.local.data.gate2Settings.enrolledOrigins, [BETA]);
      assert.equal(browser.permissions.origins.includes(`${BETA}/*`), true);
    }
    calls.push(`remove:${details.origins.join(",")}`);
    return originalRemove(details);
  };

  const result = await switchCanvasOriginAccess(BETA, browser, runtimeFor(adapter, calls));

  assert.equal(result.ok, true);
  assert.equal(result.view.enrolledOrigin, BETA);
  assert.equal(result.residualPermissionCount, 0);
  assert.deepEqual(browser.storage.local.data.gate2Settings.enrolledOrigins, [BETA]);
  assert.equal(browser.permissions.origins.includes(`${ALPHA}/*`), false);
  assert.equal(browser.permissions.origins.includes(`${BETA}/*`), true);
  assert.equal(browser.permissions.origins.includes(OPTIONAL), true);
  assert.ok(calls.indexOf(`request:${BETA}/*`) < calls.indexOf("message:ENROLL_ORIGIN"));
  assert.ok(calls.indexOf("message:ENROLL_ORIGIN") < calls.indexOf(`remove:${ALPHA}/*`));
  assert.ok(calls.indexOf(`remove:${ALPHA}/*`) < calls.indexOf("message:RECONCILE_PERMISSIONS"));
  assert.equal(adapter.getState().networkAction, "ALLOW");
});

test("failed enrollment commit restores alpha and removes the beta grant", async () => {
  const { browser, adapter } = await enrolledHarness();
  browser.storage.local.failNext = "set";

  const result = await switchCanvasOriginAccess(BETA, browser, runtimeFor(adapter));

  assert.equal(result.ok, false);
  assert.equal(result.residualPermissionCount, 0);
  assert.equal(result.view.enrolledOrigin, ALPHA);
  assert.deepEqual(browser.storage.local.data.gate2Settings.enrolledOrigins, [ALPHA]);
  assert.equal(browser.permissions.origins.includes(`${ALPHA}/*`), true);
  assert.equal(browser.permissions.origins.includes(`${BETA}/*`), false);
  assert.equal(adapter.getState().networkAction, "ALLOW");
});

test("persistent prior-permission removal failure reports the residual grant", async () => {
  const { browser, adapter } = await enrolledHarness();
  const originalRemove = browser.permissions.remove.bind(browser.permissions);
  browser.permissions.remove = async (details) => {
    if (details?.origins?.includes(`${ALPHA}/*`)) return false;
    return originalRemove(details);
  };

  const result = await switchCanvasOriginAccess(BETA, browser, runtimeFor(adapter));

  assert.equal(result.ok, false);
  assert.equal(result.code, "RESIDUAL_PERMISSION");
  assert.equal(result.residualPermissionCount, 1);
  assert.equal(result.view.enrolledOrigin, BETA);
  assert.equal(result.view.residualPermissionCount, 1);
  assert.deepEqual(browser.storage.local.data.gate2Settings.enrolledOrigins, [BETA]);
  assert.equal(browser.permissions.origins.includes(`${ALPHA}/*`), true);
  assert.equal(browser.permissions.origins.includes(`${BETA}/*`), true);
  assert.equal(adapter.getState().state, "UNCERTAIN_ALLOW");
  assert.equal(adapter.getState().networkAction, "ALLOW");
});

test("permission-removal failure rolls enrollment back to the still-granted origin", async () => {
  const { browser, adapter } = await enrolledHarness();
  browser.permissions.remove = async () => false;

  const result = await removeCanvasOriginAccess(browser, runtimeFor(adapter));

  assert.equal(result.ok, false);
  assert.equal(result.code, "PERMISSION_REMOVAL_FAILED");
  assert.equal(result.residualPermissionCount, 0);
  assert.equal(result.view.enrolledOrigin, ALPHA);
  assert.deepEqual(browser.storage.local.data.gate2Settings.enrolledOrigins, [ALPHA]);
  assert.equal(browser.permissions.origins.includes(`${ALPHA}/*`), true);
  assert.equal(adapter.getState().networkAction, "ALLOW");
});

test("successful removal clears both enrollment and exact hosted permission", async () => {
  const { browser, adapter } = await enrolledHarness();

  const result = await removeCanvasOriginAccess(browser, runtimeFor(adapter));

  assert.equal(result.ok, true);
  assert.equal(result.view.enrolledOrigin, null);
  assert.equal(result.residualPermissionCount, 0);
  assert.deepEqual(browser.storage.local.data.gate2Settings.enrolledOrigins, []);
  assert.equal(browser.permissions.origins.includes(`${ALPHA}/*`), false);
  assert.equal(browser.permissions.origins.includes(OPTIONAL), true);
  assert.equal(adapter.getState().networkAction, "ALLOW");
});
