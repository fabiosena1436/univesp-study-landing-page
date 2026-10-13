import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

type Operation = { id: string; actorId: string; signal: AbortSignal };
const operations = new AsyncLocalStorage<Operation>();
export function currentAiOperation() { return operations.getStore(); }
export function aiSignal() { return currentAiOperation()?.signal ?? AbortSignal.timeout(105000); }
export function withAiOperation<T>(actorId: string, clientSignal: AbortSignal | undefined, work: () => Promise<T>, timeoutMs = 105000) {
  const signals = [AbortSignal.timeout(timeoutMs), ...(clientSignal ? [clientSignal] : [])];
  return operations.run({ id: randomUUID(), actorId, signal: AbortSignal.any(signals) }, work);
}
