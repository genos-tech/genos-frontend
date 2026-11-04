/**
 * The task table's PR column asks for a PR's full detail at mount only when
 * that detail is live: an open or draft PR. A merged or closed PR is drawn
 * from the list and its detail is fetched when the chip is hovered or focused
 * (MIP-994).
 *
 * Why: the detail is three GitHub calls on the server (about 1.2 s the first
 * time) and a table mounts a dozen of them at once, mostly for PRs nobody is
 * looking at. What a finished PR gives up is the tiny CI dot until hover.
 */

import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrStatusCell } from "../features/integrations/components/PrStatusCell";
import { loadLinkedPullsBatched, type LinkedPull } from "../features/integrations/services/github";
import {
    getCachedOrFetchPrStatus,
    type PrStatusResult,
} from "../features/integrations/services/prStatusCache";

vi.mock("../features/integrations/services/github", () => ({
    loadLinkedPullsBatched: vi.fn(),
}));
vi.mock("../features/integrations/services/prStatusCache", () => ({
    getCachedOrFetchPrStatus: vi.fn(),
}));
// The rich card is its own component; here it only has to show up.
vi.mock("../features/integrations/components/PrHoverDetails", () => ({
    PrHoverDetails: () => <div data-testid="hover-card" />,
}));
// Render the tooltip body inline, so its text can be read without hover delays.
vi.mock("../components/ui/AppTooltip", () => ({
    AppTooltip: ({ title, children }: { title: ReactNode; children: ReactNode }) => (
        <div>
            {children}
            <div data-testid="tooltip">{title}</div>
        </div>
    ),
}));

const mockPulls = vi.mocked(loadLinkedPullsBatched);
const mockStatus = vi.mocked(getCachedOrFetchPrStatus);

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
const merged = (n: number) => pull(n, { state: "closed", merged_at: "2026-11-03T10:00:00Z" });
const closed = (n: number) => pull(n, { state: "closed" });
const draft = (n: number) => pull(n, { draft: true });

const detailFor = (p: LinkedPull, ciState: "success" | "none" = "success") =>
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
            combined_status:
                ciState === "success"
                    ? { state: "success", total_count: 1, statuses: [{ state: "success" }] }
                    : { state: "pending", total_count: 0, statuses: [] },
            check_runs:
                ciState === "success"
                    ? {
                          total_count: 1,
                          check_runs: [{ status: "completed", conclusion: "success" }],
                      }
                    : { total_count: 0, check_runs: [] },
        },
    }) as unknown as PrStatusResult;

const mount = async (pulls: LinkedPull[], token: string | null = "tok") => {
    mockPulls.mockResolvedValue(pulls);
    render(
        <CssVarsProvider>
            <PrStatusCell accessToken={token} taskId={42} />
        </CssVarsProvider>
    );
    await act(async () => {});
};

/** The tiny CI dot is the only div inside the chip (the icon is an svg). */
const hasCiDot = (chip: HTMLElement) => chip.querySelector("div") !== null;

beforeEach(() => {
    mockPulls.mockReset();
    mockStatus.mockReset();
});

describe("PrStatusCell: a merged or closed PR waits for hover", () => {
    it.each([
        ["merged", merged(7)],
        ["closed", closed(7)],
    ])("a %s PR sends nothing at mount and is drawn from the list", async (_name, p) => {
        await mount([p]);

        expect(mockStatus).not.toHaveBeenCalled();
        const chip = screen.getByRole("link");
        expect(chip.getAttribute("href")).toBe(p.html_url);
        expect(hasCiDot(chip)).toBe(false);
    });

    it("its tooltip says the state and never 'No CI' before the detail is loaded", async () => {
        await mount([merged(7)]);

        const tip = screen.getByTestId("tooltip").textContent ?? "";
        expect(tip).toContain("Merged");
        expect(tip).toContain("PR 7");
        expect(tip).not.toMatch(/CI/);
    });

    it("hovering asks once, and the CI dot and the rich card appear when it lands", async () => {
        mockStatus.mockResolvedValue(detailFor(merged(7)));
        await mount([merged(7)]);

        const chip = screen.getByRole("link");
        await act(async () => {
            fireEvent.mouseEnter(chip);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(mockStatus).toHaveBeenCalledWith("tok", merged(7).html_url);
        expect(screen.getByTestId("hover-card")).toBeTruthy();
        expect(hasCiDot(chip)).toBe(true);
    });

    it("focusing the chip asks too (keyboard users)", async () => {
        mockStatus.mockResolvedValue(detailFor(merged(7)));
        await mount([merged(7)]);

        await act(async () => {
            fireEvent.focus(screen.getByRole("link"));
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it("hovering and focusing again does not ask again", async () => {
        mockStatus.mockResolvedValue(detailFor(merged(7)));
        await mount([merged(7)]);
        const chip = screen.getByRole("link");

        for (const fire of [fireEvent.mouseEnter, fireEvent.focus, fireEvent.mouseEnter]) {
            await act(async () => {
                fire(chip);
            });
        }

        expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it("a failed lookup leaves the state chip, no CI claim, and does not retry on the next hover", async () => {
        mockStatus.mockResolvedValue({ kind: "error" });
        await mount([merged(7)]);
        const chip = screen.getByRole("link");

        await act(async () => {
            fireEvent.mouseEnter(chip);
        });
        await act(async () => {
            fireEvent.mouseEnter(chip);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(hasCiDot(chip)).toBe(false);
        expect(screen.queryByTestId("hover-card")).toBeNull();
        const tip = screen.getByTestId("tooltip").textContent ?? "";
        expect(tip).toContain("Merged");
        expect(tip).not.toMatch(/CI/);
    });

    it("a PR with no CI at all shows no dot after hover either", async () => {
        mockStatus.mockResolvedValue(detailFor(merged(7), "none"));
        await mount([merged(7)]);
        const chip = screen.getByRole("link");

        await act(async () => {
            fireEvent.mouseEnter(chip);
        });

        expect(screen.getByTestId("hover-card")).toBeTruthy();
        expect(hasCiDot(chip)).toBe(false);
    });

    it("signed out: hovering sends nothing", async () => {
        await mount([merged(7)], null);

        await act(async () => {
            fireEvent.mouseEnter(screen.getByRole("link"));
        });

        expect(mockStatus).not.toHaveBeenCalled();
    });
});

describe("PrStatusCell: an open PR is unchanged", () => {
    it.each([
        ["open", pull(7)],
        ["draft", draft(7)],
    ])("an %s PR asks at mount, with no hover, and shows the CI dot", async (_name, p) => {
        mockStatus.mockResolvedValue(detailFor(p));
        await mount([p]);

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(mockStatus).toHaveBeenCalledWith("tok", p.html_url);
        expect(hasCiDot(screen.getByRole("link"))).toBe(true);
        expect(screen.getByTestId("hover-card")).toBeTruthy();
    });

    it("its tooltip keeps the 'state · CI' line while the detail loads", async () => {
        mockStatus.mockReturnValue(new Promise(() => {})); // never lands
        await mount([pull(7)]);

        expect(screen.getByTestId("tooltip").textContent).toContain("Open · No CI");
    });
});

describe("PrStatusCell: a table of rows", () => {
    it("asks at mount only for the open ones, and hover asks for one finished PR only", async () => {
        const rows = [merged(1), pull(2), closed(3), merged(4), draft(5)];
        mockStatus.mockImplementation(async (_tok, url) =>
            detailFor(rows.find((r) => r.html_url === url) as LinkedPull)
        );
        await mount(rows);

        // Only #2 (open) and #5 (draft): 2 requests, not 5.
        expect(mockStatus.mock.calls.map((c) => c[1]).sort()).toEqual([
            pull(2).html_url,
            draft(5).html_url,
        ]);

        const chips = screen.getAllByRole("link");
        expect(chips).toHaveLength(5);
        await act(async () => {
            fireEvent.mouseEnter(chips[3]); // #4, merged
        });

        expect(mockStatus).toHaveBeenCalledTimes(3);
        expect(mockStatus).toHaveBeenLastCalledWith("tok", merged(4).html_url);
    });
});
