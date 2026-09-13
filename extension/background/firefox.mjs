// Copyright © 2026 Rolando Carreon. All rights reserved.

import { createObservationAdapter } from "../shared/browser-adapter.mjs";

const adapter = createObservationAdapter(globalThis.browser, "firefox");
void adapter.start();
