import { AsyncLocalStorage } from "node:async_hooks";
const requests = new AsyncLocalStorage<string>();
export function currentRequestId() { return requests.getStore(); }
export function withRequestId<T>(id: string, work: () => T) { return requests.run(id, work); }
