/**
 * Marketing pages store nothing and send nothing (MIP-1742): posthog-js is started
 * only once the router is on a path that is not a public marketing page. Probed with
 * posthog-js 1.445.4: no init option holds on its own (memory persistence still
 * requests config.js, opt-out by default still writes the cookie and storage).
 */
import { useEffect } from "react";
import { fireEvent, render } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    AnalyticsRouteGate,
    startAnalyticsOutsideMarketing,
} from "../components/AnalyticsRouteGate";
import { LP_ROUTES } from "../lp/seo/routes";
import { analytics } from "../services/analytics";

vi.mock("../services/analytics", () => ({
    analytics: { init: vi.fn(), capture: vi.fn() },
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe("startAnalyticsOutsideMarketing", () => {
    it.each(LP_ROUTES.map((r) => r.path))("does not start analytics on %s", (path) => {
        startAnalyticsOutsideMarketing(path);
        expect(analytics.init).not.toHaveBeenCalled();
    });

    it.each(["/blog/some-article", "/Plans", "/plans/"])(
        "does not start analytics on %s",
        (path) => {
            startAnalyticsOutsideMarketing(path);
            expect(analytics.init).not.toHaveBeenCalled();
        }
    );

    it.each(["/signin", "/signup", "/workspace", "/workspace/chat/1", "/jointeam", "/nope"])(
        "starts analytics on %s",
        (path) => {
            startAnalyticsOutsideMarketing(path);
            expect(analytics.init).toHaveBeenCalledTimes(1);
        }
    );
});

describe("AnalyticsRouteGate", () => {
    it("starts nothing for a first load of a marketing page", () => {
        render(
            <MemoryRouter initialEntries={["/plans"]}>
                <AnalyticsRouteGate />
            </MemoryRouter>
        );
        expect(analytics.init).not.toHaveBeenCalled();
    });

    it("starts analytics BEFORE the page's own effects on a direct load of an app path", () => {
        // `useAnalyticsPageviews` captures in a passive effect; `capture` drops a call made
        // before `init`, so the gate must have run by then (a layout effect).
        const order: string[] = [];
        vi.mocked(analytics.init).mockImplementation(() => void order.push("init"));
        const Page = () => {
            useEffect(() => {
                order.push("page effect");
            }, []);
            return null;
        };
        render(
            <MemoryRouter initialEntries={["/workspace/home"]}>
                <AnalyticsRouteGate />
                <Page />
            </MemoryRouter>
        );
        expect(order).toEqual(["init", "page effect"]);
    });

    it("starts analytics when a client-side navigation leaves the marketing pages", () => {
        const { getByText } = render(
            <MemoryRouter initialEntries={["/plans"]}>
                <AnalyticsRouteGate />
                <Routes>
                    <Route element={<Link to="/signup">start</Link>} path="/plans" />
                    <Route element={null} path="/signup" />
                </Routes>
            </MemoryRouter>
        );
        expect(analytics.init).not.toHaveBeenCalled();
        fireEvent.click(getByText("start"));
        expect(analytics.init).toHaveBeenCalledTimes(1);
    });
});
