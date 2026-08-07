/**
 * What the app says — and doesn't say — when a connection fails.
 *
 * Three rules, all of them about not crying wolf:
 *   1. The API-down banner names the failure it actually saw, rather than
 *      one "unreachable" line covering three different problems.
 *   2. The GitHub endpoints proxy GitHub, so their 502s mean GitHub
 *      refused the call — not that Genos is down — and must not reach the
 *      shared "Server error" toast.
 *   3. The socket has to stay down for a real five seconds before the
 *      banner appears; ordinary socket.io reconnects are shorter. A
 *      socket that has never connected yet gets much longer, because a
 *      cold handshake legitimately takes seconds, and time the tab spent
 *      in the background doesn't count at all.
 *
 * `../services/api` is mocked wholesale here so the GitHub service's
 * request config can be inspected. The other half of that seam — that
 * `suppressErrorToast` really does silence a 502 — is asserted against
 * the live interceptor in `services/requestErrorNotifier.test.ts`.
 */

import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionStatusSnackbar } from "../components/layout/ConnectionStatusSnackbar";
import {
    getPullDetail,
    listMyPulls,
    loadLinkedPulls,
} from "../features/integrations/services/github";
import { useWebSocket } from "../hooks/common/useWebSocket";
import { I18nProvider } from "../i18n";
import { authApi } from "../services/api";
import type { UserProps } from "../types/admin";

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
}));

// One fake socket per `io()` call — a shared singleton would hide the
// socket-replacement case below, where the point is that the new socket
// is a different object with its own grace window.
type FakeSocket = ReturnType<typeof makeSocket>;
const makeSocket = () => ({
    connected: true,
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
});

let currentSocket: FakeSocket = makeSocket();
vi.mock("socket.io-client", () => ({
    io: () => {
        currentSocket = makeSocket();
        return currentSocket;
    },
}));

// ---- 1. The banner names the reason --------------------------------

const renderBanner = (props: React.ComponentProps<typeof ConnectionStatusSnackbar>) =>
    render(
        <I18nProvider>
            <ConnectionStatusSnackbar {...props} />
        </I18nProvider>
    );

describe("API-down banner copy", () => {
    it("points at the user's own network when the device is offline", () => {
        renderBanner({ showApiDown: true, showWsDisconnected: false, apiDownReason: "offline" });
        expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    });

    it("says the server isn't answering when requests time out", () => {
        renderBanner({ showApiDown: true, showWsDisconnected: false, apiDownReason: "timeout" });
        expect(screen.getByText(/timing out/i)).toBeInTheDocument();
    });

    it("falls back to the generic line when the failure couldn't be placed", () => {
        // The prop is optional, so a caller that has no reason to offer
        // keeps exactly the copy this banner had before reasons existed.
        renderBanner({ showApiDown: true, showWsDisconnected: false });
        expect(screen.getByText(/api server is unreachable/i)).toBeInTheDocument();
    });

    it("says nothing while both connections are healthy", () => {
        renderBanner({ showApiDown: false, showWsDisconnected: false });
        expect(screen.queryByText(/unreachable/i)).toBeNull();
        expect(screen.queryByText(/connection lost/i)).toBeNull();
    });
});

// ---- 2. A proxied GitHub failure is not a Genos outage ---------------

describe("GitHub proxy requests", () => {
    const mockAuthApi = vi.mocked(authApi);

    beforeEach(() => {
        mockAuthApi.mockReset();
    });

    const configOf = async (call: () => Promise<unknown>, url: string) => {
        const get = vi.fn().mockResolvedValue({ data: {} });
        mockAuthApi.mockReturnValue({ get } as never);
        await call();
        const [calledUrl, config] = get.mock.calls[0];
        expect(calledUrl).toBe(url);
        return config as { suppressErrorToast?: boolean };
    };

    it("opts every pulls lookup out of the shared error toast", async () => {
        // A 502 from these is GitHub refusing the proxied call — a token
        // whose scopes don't cover the repo — which "Server error. Please
        // try again shortly." both misattributes and misadvises. Each of
        // these callers already reports its own failure.
        expect(await configOf(() => listMyPulls("tok"), "/github/pulls/")).toMatchObject({
            suppressErrorToast: true,
        });
        expect(
            await configOf(
                () => getPullDetail("tok", "acme", "rocket", 7),
                "/github/pulls/acme/rocket/7/"
            )
        ).toMatchObject({ suppressErrorToast: true });
        expect(
            await configOf(() => loadLinkedPulls("tok", 42), "/github/pulls/for-task/")
        ).toMatchObject({ suppressErrorToast: true });
    });

    it("still sends the query params alongside the opt-out", async () => {
        const config = await configOf(
            () => loadLinkedPulls("tok", 42, { bypassCache: true }),
            "/github/pulls/for-task/"
        );
        expect(config).toMatchObject({ params: { task_id: 42, fresh: "1" } });
    });
});

// ---- 3. The socket gets a grace period ------------------------------

const MYSELF = { userId: 1 } as unknown as UserProps;

describe("WebSocket disconnect grace window", () => {
    // jsdom derives `document.hidden` from `visibilityState` and offers no
    // setter, so the tab has to be faked by shadowing the property.
    const setTabHidden = (hidden: boolean) => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => hidden,
        });
        document.dispatchEvent(new Event("visibilitychange"));
    };

    beforeEach(() => {
        vi.useFakeTimers();
        setTabHidden(false);
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    const mountSocket = (teamId = "team-1") =>
        renderHook(({ team }) => useWebSocket("tok", MYSELF, team), {
            initialProps: { team: teamId },
        });

    const tick = (ms: number) =>
        act(() => {
            vi.advanceTimersByTime(ms);
        });

    it("stays quiet through a blip shorter than the window", () => {
        const { result } = mountSocket();
        tick(1000);

        currentSocket.connected = false;
        tick(3000);
        // Three seconds down is an ordinary socket.io reconnect. Announcing
        // it teaches people to ignore the banner.
        expect(result.current.showDisconnected).toBe(false);

        currentSocket.connected = true;
        tick(1000);
        expect(result.current.showDisconnected).toBe(false);
    });

    it("speaks up once a socket it has seen working stays down for the window", () => {
        const { result } = mountSocket();
        tick(1000);

        currentSocket.connected = false;
        tick(6000);
        expect(result.current.showDisconnected).toBe(true);
    });

    it("clears the banner as soon as the socket is back", () => {
        const { result } = mountSocket();
        tick(1000);

        currentSocket.connected = false;
        tick(7000);
        expect(result.current.showDisconnected).toBe(true);

        currentSocket.connected = true;
        tick(1000);
        expect(result.current.showDisconnected).toBe(false);
    });

    it("waits far longer on a socket that has never connected", () => {
        // Opening the app cold, `connected` stays false until the server's
        // connect handler has resolved the token, the team list and the
        // project list against Django. Several seconds of that is normal,
        // and the five-second window called it an outage every launch.
        const { result } = mountSocket();
        currentSocket.connected = false;

        // Six seconds is where a socket we'd already seen working would
        // have tripped the banner, per the test above.
        tick(6000);
        expect(result.current.showDisconnected).toBe(false);
        tick(16000);
        expect(result.current.showDisconnected).toBe(true);
    });

    it("doesn't hold the tab's time in the background against the socket", () => {
        // Backgrounded, the browser both throttles this poll and may
        // suspend the socket outright. Measuring the outage against the
        // wall clock means an hour hidden would otherwise be an hour of
        // "downtime" waiting to fire the moment the user looks back.
        const { result } = mountSocket();
        tick(1000);

        setTabHidden(true);
        currentSocket.connected = false;
        tick(3_600_000);
        expect(result.current.showDisconnected).toBe(false);

        setTabHidden(false);
        tick(6000);
        // Still down, but the returning tab is owed a fresh handshake, so
        // it gets the long window rather than the banner.
        expect(result.current.showDisconnected).toBe(false);
        tick(16000);
        expect(result.current.showDisconnected).toBe(true);
    });

    it("restarts the window when the socket is replaced", () => {
        // Switching team tears down the socket and opens a new one. The
        // old poll-counting version kept its tally across that swap, so a
        // fresh socket could inherit an almost-expired count and flash the
        // banner on its very first poll.
        const { result, rerender } = mountSocket();
        tick(1000);
        currentSocket.connected = false;
        tick(4000);
        expect(result.current.showDisconnected).toBe(false);

        rerender({ team: "team-2" });
        currentSocket.connected = false;
        tick(2000);
        expect(result.current.showDisconnected).toBe(false);
    });
});
