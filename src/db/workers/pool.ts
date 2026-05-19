// Persistent worker pool — main-thread side.
//
// Each WorkerChannel owns one long-lived Worker for a category of DB
// operations (chat, notes, tasks, inbox, activity, users). Callers send
// typed requests through `request(type, payload)` and receive a Promise
// that resolves with the worker's reply. Requests are correlated via an
// auto-incrementing id, so a single worker can serve many concurrent
// callers without one's reply being dispatched to another.
//
// The previous architecture spawned a fresh Worker per call and closed it
// on the first reply. That paid worker-startup cost on every operation,
// which became visible on hot paths like read-status updates during scroll
// (one worker per scroll tick). Reusing one worker per category amortises
// that cost across the lifetime of the page.
//
// Lifecycle:
//   - The worker is created lazily on the first request.
//   - On worker error, all in-flight promises reject, the worker is
//     terminated, and the next request gets a fresh worker.
//   - `terminate()` is intended for tests / module hot-reload; production
//     code does not need to call it.

export type WorkerRequest<T = unknown> = {
    correlationId: number;
    type: string;
    payload: T;
};

export type WorkerReply<T = unknown> =
    | { correlationId: number; ok: true; data: T }
    | { correlationId: number; ok: false; error: string };

type PendingSlot = {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
};

// A contract maps a string `type` to its request/response shape pair.
export type ContractMap = Record<string, { req: unknown; res: unknown }>;

export class WorkerChannel<C extends ContractMap> {
    private worker: Worker | null = null;
    private readonly pending = new Map<number, PendingSlot>();
    private nextId = 1;

    constructor(
        private readonly name: string,
        private readonly factory: () => Worker
    ) {}

    request<K extends keyof C & string>(type: K, payload: C[K]["req"]): Promise<C[K]["res"]> {
        const worker = this.ensureWorker();
        const correlationId = this.nextId++;
        return new Promise<C[K]["res"]>((resolve, reject) => {
            this.pending.set(correlationId, {
                resolve: resolve as (value: unknown) => void,
                reject,
            });
            const request: WorkerRequest<C[K]["req"]> = { correlationId, payload, type };
            worker.postMessage(request);
        });
    }

    terminate(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        const err = new Error(`[worker:${this.name}] channel terminated`);
        for (const slot of this.pending.values()) slot.reject(err);
        this.pending.clear();
    }

    private ensureWorker(): Worker {
        if (this.worker) return this.worker;
        const w = this.factory();
        w.onmessage = (event: MessageEvent<WorkerReply<unknown>>) =>
            this.handleMessage(event.data);
        w.onerror = (event: ErrorEvent) => this.handleError(event);
        this.worker = w;
        return w;
    }

    private handleMessage(reply: WorkerReply<unknown>): void {
        const slot = this.pending.get(reply.correlationId);
        if (!slot) return;
        this.pending.delete(reply.correlationId);
        if (reply.ok) slot.resolve(reply.data);
        else slot.reject(new Error(reply.error));
    }

    private handleError(event: ErrorEvent): void {
        const err = new Error(`[worker:${this.name}] ${event.message || "worker error"}`);
        for (const slot of this.pending.values()) slot.reject(err);
        this.pending.clear();
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
