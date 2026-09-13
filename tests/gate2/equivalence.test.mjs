// Copyright © 2026 Rolando Carreon. All rights reserved.

import assert from "node:assert/strict";
import test from "node:test";

import { runSyntheticHarness, SYNTHETIC_FLOWS } from "./synthetic-harness.mjs";

test("T-EQUIV-01 T-EQUIV-02 protected flow receipts are byte-equivalent", async () => {
  const first = await runSyntheticHarness();
  const second = await runSyntheticHarness();
  assert.equal(first.flowCount, 24);
  assert.equal(first.flowCount, SYNTHETIC_FLOWS.length);
  assert.equal(first.receiptsByteEquivalent, true);
  assert.equal(first.disabledReceiptSha256, first.enabledReceiptSha256);
  assert.equal(first.listenerAlwaysReturnedUndefined, true);
  assert.equal(first.forbiddenCanaryFound, false);
  assert.equal(first.everyStateAllows, true);
  assert.deepEqual(first, second);
});
