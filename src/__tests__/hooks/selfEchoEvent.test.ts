import { afterEach, describe, expect, it, vi } from "vitest";

import {
    dispatchSelfEcho,
    SELF_ECHO_EVENT,
    SelfEchoDetail,
} from "../../hooks/common/selfEchoEvent";

describe("dispatchSelfEcho", () => {
    afterEach(() => vi.restoreAllMocks());

    it("dispatches a CustomEvent on window carrying the echoed fields verbatim", () => {
        const received: SelfEchoDetail[] = [];
        const listener = (e: Event) => received.push((e as CustomEvent<SelfEchoDetail>).detail);
        window.addEventListener(SELF_ECHO_EVENT, listener);

        dispatchSelfEcho({
            userId: "u-me",
            isOfflineForced: "true",
            customStatus: "🏝 OOO",
            customStatusExpiry: "2026-08-11T09:00:00Z",
            isNotificationsPaused: true,
        });

        window.removeEventListener(SELF_ECHO_EVENT, listener);
        expect(received).toHaveLength(1);
        expect(received[0]).toEqual({
            userId: "u-me",
            isOfflineForced: "true",
            customStatus: "🏝 OOO",
            customStatusExpiry: "2026-08-11T09:00:00Z",
            isNotificationsPaused: true,
        });
    });
});
