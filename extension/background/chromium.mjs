// Copyright © 2026 Rolando Carreon. All rights reserved.

import { createObservationAdapter } from "../shared/browser-adapter.mjs";

const adapter = createObservationAdapter(globalThis.chrome, "chromium");
void adapter.start();
