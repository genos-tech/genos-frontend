// Worker-side helper for the persistent worker pool.
//
// A category worker (e.g. chatWorker.ts) calls `registerHandlers({...})`
// with a record of `type → handler` entries. The helper installs a single
// `self.onmessage` that dispatches incoming WorkerRequest messages to the
// matching handler and posts a WorkerReply back. Workers stay alive between
// requests; the channel on the main thread treats them as long-lived.

import type { ContractMap, WorkerReply, WorkerRequest } from "./pool";

export type HandlerMap<C extends ContractMap> = {
    [K in keyof C]: (payload: C[K]["req"]) => Promise<C[K]["res"]> | C[K]["res"];
};

declare const self: DedicatedWorkerGlobalScope & typeof globalThis;

export const registerHandlers = <C extends ContractMap>(handlers: HandlerMap<C>): void => {
    self.onmessage = async (event: MessageEvent<WorkerRequest<unknown>>) => {
        const { correlationId, type, payload } = event.data;
        const handler = (handlers as Record<string, (payload: unknown) => unknown>)[type];
        if (!handler) {
            const reply: WorkerReply = {
                correlationId,
                error: `Unknown request type: ${type}`,
                ok: false,
            };
            self.postMessage(reply);
            return;
        }
        try {
            const data = await handler(payload);
            const reply: WorkerReply = { correlationId, data, ok: true };
            self.postMessage(reply);
        } catch (err) {
            const reply: WorkerReply = {
                correlationId,
                error: err instanceof Error ? err.message : String(err),
                ok: false,
            };
            self.postMessage(reply);
        }
    };
};
