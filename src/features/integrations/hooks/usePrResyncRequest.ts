import { useSyncExternalStore } from "react";

import { getPrResyncRequest, subscribePrResync, type PrResyncRequest } from "../services/prResync";

/**
 * The latest request for the PR column to re-sync (MIP-1409), or `{ id: 0 }` before any.
 * Subscribing is what keeps the once-a-minute clock running: it runs while a PR cell is
 * mounted and not otherwise.
 */
export const usePrResyncRequest = (): PrResyncRequest =>
    useSyncExternalStore(subscribePrResync, getPrResyncRequest, getPrResyncRequest);
