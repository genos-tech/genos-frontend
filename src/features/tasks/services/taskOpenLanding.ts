// Lands the results of a task open's side loaders together (MIP-968).
//
// Opening a task starts seven independent loads: comments, activity, notes,
// dependencies, the child tasks, the delivery links and, for a subtask, the
// parent. Each one writes its own state after its own `await`. Responses come
// at different times, React cannot batch across separate tasks, so every
// landing was its own render pass (a whole page's worth: the comment list and
// the dependency map live in the task manager, far above the preview) and one
// open cost about seven.
//
// The loaders keep starting where they start and keep their caches. What
// changes is only WHEN each one writes: a loader hands its write to the
// landing of the open it belongs to instead of running it. The landing holds
// the writes until every loader that took part has answered, then runs them
// in one synchronous loop (one batch, one render), or after `waitMs` at the
// latest, so one slow endpoint does not keep the others from showing. A loader
// that answers after that writes on its own, and so does every refresh (a new
// comment, a window focus, a note change): only the first answers of an open
// are gathered.
//
// How a loader takes part: `join` when it starts, then `land` with its write
// when the answer is in, `cancel` when it will not write (its effect was
// cleaned up). Without a landing (any host that is not a task preview) the
// caller uses `passThroughTicket`, which writes at once.
//
// The lifecycle is driven by the preview:
//   arm(id)  - the preview shows task `id` now. Drops what the previous open
//              queued (that batch was never going to be shown) and starts the
//              wait. Loaders can join from here until `seal`.
//   seal(id) - every block of the preview has started its loads for `id` (the
//              working copy caught up with the requested task, and a commit's
//              child effects run before their parent's). Without this step a
//              warm switch would flush early: cached answers resolve in a
//              microtask, before the blocks that mount a commit later have
//              joined, and "nothing is pending" would be true too soon.
//   Once sealed, the writes run as soon as nothing is outstanding.

/** The longest a batch waits for a slow endpoint. */
export const OPEN_LANDING_WAIT_MS = 800;

export type LandingTicket = {
    /** The answer is in: run `write` now, or together with the rest of the open. */
    land: (write: () => void) => void;
    /** This loader will not write after all (its effect was cleaned up). */
    cancel: () => void;
};

export type OpenLanding = {
    arm: (taskId: number | null) => void;
    seal: (taskId: number) => void;
    join: (taskId: number, key: string) => LandingTicket;
    dispose: () => void;
};

/** Writes at once. For loaders outside a task preview, and for refreshes. */
export const passThroughTicket: LandingTicket = {
    land: (write) => write(),
    cancel: () => undefined,
};

type Phase = "idle" | "open" | "sealed" | "flushed";

type Ticket = LandingTicket & { key: string };

export const createOpenLanding = (waitMs: number = OPEN_LANDING_WAIT_MS): OpenLanding => {
    let phase: Phase = "idle";
    let armedId: number | null = null;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Loaders that joined and have not answered yet, by key.
    let outstanding = new Map<string, Ticket>();
    let queued: Array<() => void> = [];

    const stopTimer = () => {
        if (timer != null) clearTimeout(timer);
        timer = null;
    };

    const flush = () => {
        stopTimer();
        phase = "flushed";
        const writes = queued;
        queued = [];
        // Loaders still outstanding find the landing flushed and write on their own.
        for (const write of writes) {
            try {
                write();
            } catch (error) {
                // One failing write must not keep the others from landing.
                console.error("Task open landing: a write failed", error);
            }
        }
    };

    const flushIfDone = () => {
        if (phase === "sealed" && outstanding.size === 0) flush();
    };

    const makeTicket = (key: string): Ticket => {
        const ticketGeneration = generation;
        let done = false;
        const ticket: Ticket = {
            key,
            land: (write) => {
                if (done) return;
                done = true;
                if (outstanding.get(key) === ticket) outstanding.delete(key);
                // After the flush, and for an answer that belongs to an open
                // that has been replaced: nothing to wait for any more.
                if (ticketGeneration !== generation || (phase !== "open" && phase !== "sealed")) {
                    write();
                    return;
                }
                queued.push(write);
                flushIfDone();
            },
            cancel: () => {
                if (done) return;
                done = true;
                if (outstanding.get(key) === ticket) outstanding.delete(key);
                flushIfDone();
            },
        };
        return ticket;
    };

    return {
        arm: (taskId) => {
            stopTimer();
            generation += 1;
            // The previous open's queued writes are never run: they belonged
            // to a task that is no longer the one being opened.
            queued = [];
            outstanding = new Map();
            armedId = taskId;
            if (taskId == null) {
                phase = "idle";
                return;
            }
            phase = "open";
            timer = setTimeout(flush, waitMs);
        },
        seal: (taskId) => {
            if (phase !== "open" || taskId !== armedId) return;
            phase = "sealed";
            flushIfDone();
        },
        join: (taskId, key) => {
            if (phase !== "open" || taskId !== armedId) return passThroughTicket;
            // The same loader starting again inside one open (its effect re-ran)
            // replaces its earlier ticket instead of waiting for it.
            outstanding.get(key)?.cancel();
            const ticket = makeTicket(key);
            outstanding.set(key, ticket);
            return ticket;
        },
        dispose: () => {
            stopTimer();
            generation += 1;
            queued = [];
            outstanding = new Map();
            armedId = null;
            phase = "idle";
        },
    };
};
