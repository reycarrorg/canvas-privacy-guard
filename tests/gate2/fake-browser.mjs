// Copyright © 2026 Rolando Carreon. All rights reserved.

export class FakeEvent {
  constructor() {
    this.listeners = new Set();
    this.registrations = [];
  }

  addListener(listener, ...registration) {
    this.listeners.add(listener);
    this.registrations.push(registration);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  hasListener(listener) {
    return this.listeners.has(listener);
  }

  emitSync(...args) {
    return [...this.listeners].map((listener) => listener(...structuredClone(args)));
  }

  async emit(...args) {
    return Promise.all(this.emitSync(...args));
  }
}

class FakeLocalStorage {
  constructor(initial = {}) {
    this.data = structuredClone(initial);
    this.failNext = null;
  }

  maybeFail(operation) {
    if (this.failNext === operation) {
      this.failNext = null;
      throw new Error("SYNTHETIC_STORAGE_FAILURE");
    }
  }

  async get(key) {
    this.maybeFail("get");
    if (typeof key === "string") {
      return key in this.data ? { [key]: structuredClone(this.data[key]) } : {};
    }
    return structuredClone(this.data);
  }

  async set(values) {
    this.maybeFail("set");
    Object.assign(this.data, structuredClone(values));
  }

  async remove(key) {
    this.maybeFail("remove");
    delete this.data[key];
  }
}

export function makeFakeBrowser({
  settings = { schemaVersion: 1, disabled: false, enrolledOrigins: ["https://canvas.test.invalid"] },
  permissions = ["https://canvas.test.invalid/*", "https://optional.test.invalid/*"],
  tabs = [{ id: 1, windowId: 1, incognito: false, url: "https://canvas.test.invalid/courses/synthetic" }],
  activity = [],
} = {}) {
  const local = new FakeLocalStorage({ gate2Settings: settings, gate2Activity: activity });
  const api = {
    storage: { local },
    alarms: {
      rows: {},
      create: async (name, details) => { api.alarms.rows[name] = structuredClone(details); },
      clear: async (name) => delete api.alarms.rows[name],
      onAlarm: new FakeEvent(),
    },
    permissions: {
      origins: [...permissions],
      requestCalls: [],
      removeCalls: [],
      getAll: async () => ({ origins: [...api.permissions.origins] }),
      request: async (details) => {
        api.permissions.requestCalls.push(structuredClone(details));
        for (const origin of details?.origins || []) {
          if (!api.permissions.origins.includes(origin)) api.permissions.origins.push(origin);
        }
        return true;
      },
      remove: async (details) => {
        api.permissions.removeCalls.push(structuredClone(details));
        const before = api.permissions.origins.length;
        const removed = new Set(details?.origins || []);
        api.permissions.origins = api.permissions.origins.filter((origin) => !removed.has(origin));
        return api.permissions.origins.length !== before;
      },
      onAdded: new FakeEvent(),
      onRemoved: new FakeEvent(),
    },
    tabs: {
      rows: structuredClone(tabs),
      query: async () => structuredClone(api.tabs.rows),
      onUpdated: new FakeEvent(),
      onRemoved: new FakeEvent(),
      onReplaced: new FakeEvent(),
    },
    runtime: {
      onStartup: new FakeEvent(),
      onInstalled: new FakeEvent(),
      onSuspend: new FakeEvent(),
      onMessage: new FakeEvent(),
    },
    webRequest: { onBeforeRequest: new FakeEvent() },
  };
  return api;
}

export async function flushAsyncWork() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}
