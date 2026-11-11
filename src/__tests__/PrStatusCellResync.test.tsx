/**
 * MIP-1409. The task table's PR column used to ask once per row mount and never again, so a PR
 * that merged, or a CI run that finished, showed its old state until the table was re-opened.
 * A re-sync request (the Refresh tasks click, or the once-a-minute poll) now makes the cells ask
 * again.
 *
 * What these pin down:
 *  - WHO asks. A click: every row, with `fresh`. A poll: only rows showing an open or draft PR,
 *    without `fresh`. Each of those is a GitHub call per matching branch.
 *  - what the chip does with the answer, including when the answer is a failure or is empty.
 */

import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrStatusCell } from "../features/integrations/components/PrStatusCell";
import {
    loadLinkedPullsBatched,
    refreshLinkedPullsBatched,
    type LinkedPull,
} from "../features/integrations/services/github";
import {
    _resetPrResyncForTests,
    PR_RESYNC_INTERVAL_MS,
    reportPrResyncOutcome,
    requestPrResync,
} from "../features/integrations/services/prResync";
import {
    getCachedOrFetchPrStatus,
    type PrStatusResult,
} from "../features/integrations/services/prStatusCache";
import { prStateColor, type PrState } from "../features/integrations/utils/prState";

vi.mock("../features/integrations/services/github", () => ({
    loadLinkedPullsBatched: vi.fn(),
    refreshLinkedPullsBatched: vi.fn(),
}));
vi.mock("../features/integrations/services/prStatusCache", () => ({
    getCachedOrFetchPrStatus: vi.fn(),
}));
// The real clock and signal; only the outcome report is watched.
vi.mock("../features/integrations/services/prResync", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("../features/integrations/services/prResync")>();
    return { ...actual, reportPrResyncOutcome: vi.fn(actual.reportPrResyncOutcome) };
});
vi.mock("../features/integrations/components/PrHoverDetails", () => ({
    PrHoverDetails: () => <div data-testid="hover-card" />,
}));
vi.mock("../components/ui/AppTooltip", () => ({
    AppTooltip: ({ title, children }: { title: ReactNode; children: ReactNode }) => (
        <div>
            {children}
            <div data-testid="tooltip">{title}</div>
        </div>
    ),
}));

const mockLoad = vi.mocked(loadLinkedPullsBatched);
const mockRefresh = vi.mocked(refreshLinkedPullsBatched);
const mockStatus = vi.mocked(getCachedOrFetchPrStatus);
const mockReport = vi.mocked(reportPrResyncOutcome);

const pull = (number: number, over: Partial<LinkedPull> = {}): LinkedPull => ({
    owner: "acme",
    repo: "rocket",
    branch: `GEN-42-${number}`,
    number,
    html_url: `https://github.com/acme/rocket/pull/${number}`,
    title: `PR ${number}`,
    state: "open",
    draft: false,
    merged_at: null,
    ...over,
});
const merged = (n: number) => pull(n, { state: "closed", merged_at: "2026-11-11T01:00:00Z" });

const detailFor = (p: LinkedPull, ci: "success" | "none" = "none") =>
    ({
        kind: "ok",
        payload: {
            pull: {
                number: p.number,
                title: p.title,
                state: p.state,
                draft: p.draft,
                merged: p.merged_at != null,
                base: { repo: { full_name: "acme/rocket" } },
            },
            combined_status: { state: "pending", total_count: 0, statuses: [] },
            check_runs:
                ci === "success"
                    ? {
                          total_count: 1,
                          check_runs: [{ status: "completed", conclusion: "success" }],
                      }
                    : { total_count: 0, check_runs: [] },
        },
    }) as unknown as PrStatusResult;

// A colour as the DOM reports it, so a chip's icon can be compared with a state.
const dom = (color: string) => {
    const probe = document.createElement("div");
    probe.style.color = color;
    return probe.style.color;
};
const stateOf = (chip: HTMLElement): PrState | "?" => {
    const color = (chip.querySelector("svg") as SVGElement).style.color;
    return (
        (["open", "merged", "closed", "draft"] as const).find(
            (s) => dom(prStateColor(s)) === color
        ) ?? "?"
    );
};
const hasCiDot = (chip: HTMLElement) => chip.querySelector("div") !== null;

/** Rows by task id; each row's list is what a first load returns. */
const mountRows = async (rows: Record<number, LinkedPull[]>, token: string | null = "tok") => {
    mockLoad.mockImplementation(async (_t, id) => rows[Number(id)] ?? []);
    const view = render(
        <CssVarsProvider>
            {Object.keys(rows).map((id) => (
                <div key={id} data-testid={`row-${id}`}>
                    <PrStatusCell accessToken={token} taskId={Number(id)} />
                </div>
            ))}
        </CssVarsProvider>
    );
    await act(async () => {});
    return view;
};
const chipIn = (taskId: number) =>
    screen.getByTestId(`row-${taskId}`).querySelector("a") as HTMLElement;
const chipsIn = (taskId: number) => screen.getByTestId(`row-${taskId}`).querySelectorAll("a");

/** Send a request and let the answers land. */
const resync = async (reason: "manual" | "poll") => {
    await act(async () => {
        requestPrResync(reason);
    });
};

beforeEach(() => {
    _resetPrResyncForTests();
    mockLoad.mockReset();
    mockRefresh.mockReset();
    mockStatus.mockReset();
    mockReport.mockClear();
    mockStatus.mockImplementation(async (_t, url) => ({ kind: "error", url }) as never);
});

afterEach(() => {
    vi.useRealTimers();
});

describe("a poll", () => {
    it("re-asks for a row showing an open PR: the list without `fresh`, and the PR's detail past the memo", async () => {
        mockStatus.mockResolvedValue(detailFor(pull(7)));
        await mountRows({ 1: [pull(7)] });
        expect(mockStatus).toHaveBeenCalledTimes(1);
        mockRefresh.mockResolvedValue([pull(7)]);

        await resync("poll");

        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(mockRefresh).toHaveBeenCalledWith("tok", 1, { fresh: false });
        expect(mockStatus).toHaveBeenCalledTimes(2);
        expect(mockStatus).toHaveBeenLastCalledWith("tok", pull(7).html_url, undefined, {
            forceRefresh: true,
        });
    });

    it("leaves alone a row whose PRs are all finished, and a row with no PR", async () => {
        await mountRows({ 1: [pull(7)], 2: [merged(8)], 3: [] });
        mockRefresh.mockResolvedValue([pull(7)]);

        await resync("poll");

        // One request's worth of rows: only task 1 took part.
        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(mockRefresh.mock.calls[0][1]).toBe(1);
    });

    it("a draft PR is live too", async () => {
        await mountRows({ 1: [pull(7, { draft: true })] });
        mockRefresh.mockResolvedValue([pull(7, { draft: true })]);
        await resync("poll");
        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it("a row that still has one live PR among merged ones takes part, and only its live PR's detail is re-asked", async () => {
        mockStatus.mockImplementation(async (_t, url) =>
            detailFor(url.endsWith("/7") ? pull(7) : merged(8))
        );
        await mountRows({ 1: [pull(7), merged(8)] });
        // Hover the merged one so its detail is showing too.
        await act(async () => {
            fireEvent.mouseEnter(screen.getByTestId("row-1").querySelectorAll("a")[1]);
        });
        mockStatus.mockClear();
        mockRefresh.mockResolvedValue([pull(7), merged(8)]);

        await resync("poll");

        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(mockStatus.mock.calls[0][1]).toBe(pull(7).html_url);
    });

    it("shows a PR that merged since: the chip becomes a merged one", async () => {
        mockStatus.mockResolvedValue(detailFor(pull(7)));
        await mountRows({ 1: [pull(7)] });
        expect(stateOf(chipIn(1))).toBe("open");
        mockRefresh.mockResolvedValue([merged(7)]);
        mockStatus.mockResolvedValue(detailFor(merged(7)));

        await resync("poll");

        expect(stateOf(chipIn(1))).toBe("merged");
    });

    it("a merged list beats a stale open detail when the detail refresh fails", async () => {
        mockStatus.mockResolvedValue(detailFor(pull(7)));
        await mountRows({ 1: [pull(7)] });
        mockRefresh.mockResolvedValue([merged(7)]);
        mockStatus.mockResolvedValue({ kind: "error" });

        await resync("poll");

        // Not drawn open: the old open detail is ignored, and its card with it.
        expect(stateOf(chipIn(1))).toBe("merged");
        expect(screen.queryByTestId("hover-card")).toBeNull();
        expect(screen.getByTestId("tooltip").textContent).toContain("Merged");
    });

    it("picks up CI finishing", async () => {
        mockStatus.mockResolvedValue(detailFor(pull(7), "none"));
        await mountRows({ 1: [pull(7)] });
        expect(hasCiDot(chipIn(1))).toBe(false);
        mockRefresh.mockResolvedValue([pull(7)]);
        mockStatus.mockResolvedValue(detailFor(pull(7), "success"));

        await resync("poll");

        expect(hasCiDot(chipIn(1))).toBe(true);
    });

    it("a failed list request keeps the chips and reports the failure to the clock", async () => {
        mockStatus.mockResolvedValue(detailFor(pull(7)));
        await mountRows({ 1: [pull(7)] });
        mockRefresh.mockResolvedValue(null);

        await resync("poll");

        expect(chipsIn(1)).toHaveLength(1);
        expect(stateOf(chipIn(1))).toBe("open");
        expect(mockReport).toHaveBeenCalledWith(1, false);
    });

    it("a failed detail refresh keeps the CI dot it had", async () => {
        mockStatus.mockResolvedValue(detailFor(pull(7), "success"));
        await mountRows({ 1: [pull(7)] });
        expect(hasCiDot(chipIn(1))).toBe(true);
        mockRefresh.mockResolvedValue([pull(7)]);
        mockStatus.mockResolvedValue({ kind: "error" });

        await resync("poll");

        expect(hasCiDot(chipIn(1))).toBe(true);
    });

    it("an answer of 'no PRs' for a row that had some is not believed (a refusing GitHub reads as that)", async () => {
        mockStatus.mockResolvedValue(detailFor(pull(7)));
        await mountRows({ 1: [pull(7)] });
        mockRefresh.mockResolvedValue([]);

        await resync("poll");

        expect(chipsIn(1)).toHaveLength(1);
        // It is not a failed request, so the clock is not slowed down.
        expect(mockReport).toHaveBeenCalledWith(1, true);
    });

    it("a PR dropping out of a row that keeps another is believed", async () => {
        await mountRows({ 1: [pull(7), pull(8)] });
        mockRefresh.mockResolvedValue([pull(8)]);

        await resync("poll");

        expect(chipsIn(1)).toHaveLength(1);
        expect(chipIn(1).getAttribute("href")).toBe(pull(8).html_url);
    });
});

describe("a click on Refresh tasks", () => {
    it("every row re-asks the list with `fresh`: open, merged and empty alike", async () => {
        await mountRows({ 1: [pull(7)], 2: [merged(8)], 3: [] });
        mockRefresh.mockResolvedValue([]);

        await resync("manual");

        expect(mockRefresh.mock.calls.map((c) => [c[1], c[2]])).toEqual([
            [1, { fresh: true }],
            [2, { fresh: true }],
            [3, { fresh: true }],
        ]);
    });

    it("a merged PR whose detail was never asked for is not asked for now either", async () => {
        await mountRows({ 2: [merged(8)] });
        mockRefresh.mockResolvedValue([merged(8)]);

        await resync("manual");

        expect(mockStatus).not.toHaveBeenCalled();
    });

    it("a merged PR the user has hovered (its detail is showing) is re-asked", async () => {
        mockStatus.mockResolvedValue(detailFor(merged(8)));
        await mountRows({ 2: [merged(8)] });
        await act(async () => {
            fireEvent.mouseEnter(chipIn(2));
        });
        expect(mockStatus).toHaveBeenCalledTimes(1);
        mockRefresh.mockResolvedValue([merged(8)]);

        await resync("manual");

        expect(mockStatus).toHaveBeenCalledTimes(2);
        expect(mockStatus).toHaveBeenLastCalledWith("tok", merged(8).html_url, undefined, {
            forceRefresh: true,
        });
    });

    it("re-asks the detail of an open PR past the memo", async () => {
        mockStatus.mockResolvedValue(detailFor(pull(7)));
        await mountRows({ 1: [pull(7)] });
        mockRefresh.mockResolvedValue([pull(7)]);

        await resync("manual");

        expect(mockStatus).toHaveBeenLastCalledWith("tok", pull(7).html_url, undefined, {
            forceRefresh: true,
        });
    });

    it("a PR opened since appears on a row that had none", async () => {
        await mountRows({ 1: [] });
        expect(chipsIn(1)).toHaveLength(0);
        mockRefresh.mockResolvedValue([pull(9)]);

        await resync("manual");

        expect(chipsIn(1)).toHaveLength(1);
        expect(chipIn(1).getAttribute("href")).toBe(pull(9).html_url);
    });

    it("takes 'no PRs' as the answer: the user asked", async () => {
        await mountRows({ 1: [pull(7)] });
        mockRefresh.mockResolvedValue([]);

        await resync("manual");

        expect(chipsIn(1)).toHaveLength(0);
    });

    it("a failed request keeps the chips here too", async () => {
        await mountRows({ 1: [pull(7)] });
        mockRefresh.mockResolvedValue(null);

        await resync("manual");

        expect(chipsIn(1)).toHaveLength(1);
        // A click's outcome is not reported: it never slows the poll.
        expect(mockReport).not.toHaveBeenCalled();
    });
});

describe("who does not take part", () => {
    it("a cell that mounts after the request does not answer it: its own first load is the sync", async () => {
        requestPrResync("manual");
        await mountRows({ 1: [pull(7)] });
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("a cell still on its first load has nothing to refresh", async () => {
        let release: (p: LinkedPull[]) => void = () => {};
        mockLoad.mockImplementation(() => new Promise((resolve) => (release = resolve)));
        render(
            <CssVarsProvider>
                <PrStatusCell accessToken="tok" taskId={1} />
            </CssVarsProvider>
        );
        await act(async () => {});

        await resync("manual");
        expect(mockRefresh).not.toHaveBeenCalled();

        await act(async () => release([pull(7)]));
        expect(screen.getByRole("link")).toBeTruthy();
    });

    it("with no access token nothing is asked", async () => {
        await mountRows({ 1: [pull(7)] }, null);
        await resync("manual");
        expect(mockRefresh).not.toHaveBeenCalled();
    });
});

describe("the clock, through the cells", () => {
    it("a mounted cell makes the table poll by itself once a minute, and unmounting stops it", async () => {
        vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
        const view = await mountRows({ 1: [pull(7)] });
        mockRefresh.mockResolvedValue([pull(7)]);

        await act(async () => {
            vi.advanceTimersByTime(PR_RESYNC_INTERVAL_MS);
        });
        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(mockRefresh).toHaveBeenCalledWith("tok", 1, { fresh: false });

        view.unmount();
        await act(async () => {
            vi.advanceTimersByTime(5 * PR_RESYNC_INTERVAL_MS);
        });
        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("a table with nothing to follow still ticks but asks nobody", async () => {
        vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
        await mountRows({ 1: [merged(7)], 2: [] });

        await act(async () => {
            vi.advanceTimersByTime(3 * PR_RESYNC_INTERVAL_MS);
        });

        expect(mockRefresh).not.toHaveBeenCalled();
    });
});

// A guard for the test file itself: the helper that reads a chip's state must tell states apart,
// or every "becomes merged" assertion above would pass for the wrong reason.
describe("stateOf", () => {
    it("tells the four states apart", async () => {
        await mountRows({
            1: [pull(1)],
            2: [pull(2, { draft: true })],
            3: [merged(3)],
            4: [pull(4, { state: "closed" })],
        });
        expect([1, 2, 3, 4].map((id) => stateOf(chipIn(id)))).toEqual([
            "open",
            "draft",
            "merged",
            "closed",
        ]);
    });
});
