/**
 * A Delivery row's PR shows the PR card when it is hovered or focused, in place
 * of a plain tooltip (MIP-1001).
 *
 * The card is fetched on the first hover and not before: a task with a dozen
 * PRs sends nothing when it opens. Until it lands, or if the lookup fails, the
 * tooltip is what it always was (the PR title, or the URL).
 */

import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCachedOrFetchPrStatus } from "../features/integrations/services/prStatusCache";
import { TaskDeliveriesBlock } from "../features/tasks/components/contents/base/TaskDeliveriesBlock";
import type { TaskDeliveryProps } from "../types/tasks";

vi.mock("../features/integrations/services/prStatusCache", () => ({
    getCachedOrFetchPrStatus: vi.fn(),
}));
vi.mock("../features/integrations/components/PrHoverDetails", () => ({
    PrHoverDetails: () => <div data-testid="pr-card" />,
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

const mockStatus = vi.mocked(getCachedOrFetchPrStatus);

const delivery = (n: number, over: Partial<TaskDeliveryProps> = {}): TaskDeliveryProps => ({
    delivery_id: n,
    repo: "genos-tech/genos-api",
    branch: `MIP-${n}`,
    pr_url: `https://github.com/genos-tech/genos-api/pull/${n}`,
    pr_number: n,
    pr_title: `Title ${n}`,
    state: "merged",
    merged_at: "2026-11-03T10:00:00Z",
    source: "webhook",
    ...over,
});

const detail = (n: number) =>
    ({
        kind: "ok",
        payload: {
            pull: { number: n, title: `Live ${n}`, base: { repo: { full_name: "x/y" } } },
            combined_status: null,
            check_runs: null,
        },
    }) as never;

const renderBlock = (rows: TaskDeliveryProps[], accessToken: string | null = "tok") =>
    render(
        <CssVarsProvider>
            <TaskDeliveriesBlock
                accessToken={accessToken}
                deliveries={rows}
                isDark={false}
                taskStatus="Closed"
            />
        </CssVarsProvider>
    );

const prLinks = () => screen.getAllByRole("link");

beforeEach(() => {
    mockStatus.mockReset();
});

describe("TaskDeliveriesBlock: the PR card is the hover action", () => {
    it("a task with several PRs sends nothing when it opens", () => {
        renderBlock([delivery(1), delivery(2), delivery(3), delivery(4)]);

        expect(prLinks()).toHaveLength(4);
        expect(mockStatus).not.toHaveBeenCalled();
        expect(screen.queryByTestId("pr-card")).toBeNull();
    });

    it("before anyone hovers, the tooltip is the title as it always was", () => {
        renderBlock([delivery(1)]);

        expect(screen.getByTestId("tooltip").textContent).toBe("Title 1");
    });

    it("a PR with no title falls back to the URL", () => {
        renderBlock([delivery(1, { pr_title: null })]);

        expect(screen.getByTestId("tooltip").textContent).toBe(
            "https://github.com/genos-tech/genos-api/pull/1"
        );
    });

    it("hover asks once for that PR, then the PR card replaces the plain tooltip", async () => {
        mockStatus.mockResolvedValue(detail(2));
        renderBlock([delivery(1), delivery(2), delivery(3)]);

        await act(async () => {
            fireEvent.mouseEnter(prLinks()[1]);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(mockStatus).toHaveBeenCalledWith(
            "tok",
            "https://github.com/genos-tech/genos-api/pull/2"
        );
        // One card, and the plain title tooltip of that row is gone.
        expect(screen.getAllByTestId("pr-card")).toHaveLength(1);
        expect(screen.getAllByTestId("tooltip").map((t) => t.textContent)).toEqual([
            "Title 1",
            "",
            "Title 3",
        ]);
    });

    it("focus asks too (keyboard users)", async () => {
        mockStatus.mockResolvedValue(detail(1));
        renderBlock([delivery(1)]);

        await act(async () => {
            fireEvent.focus(prLinks()[0]);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("pr-card")).toBeTruthy();
    });

    it("further hovers and focuses do not ask again", async () => {
        mockStatus.mockResolvedValue(detail(1));
        renderBlock([delivery(1)]);

        for (const fire of [fireEvent.mouseEnter, fireEvent.focus, fireEvent.mouseEnter]) {
            await act(async () => {
                fire(prLinks()[0]);
            });
        }

        expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it("a failed lookup leaves the plain tooltip, shows no card, and is not retried", async () => {
        mockStatus.mockResolvedValue({ kind: "error" });
        renderBlock([delivery(1)]);

        await act(async () => {
            fireEvent.mouseEnter(prLinks()[0]);
        });
        await act(async () => {
            fireEvent.mouseEnter(prLinks()[0]);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("pr-card")).toBeNull();
        expect(screen.getByTestId("tooltip").textContent).toBe("Title 1");
    });

    it("a user without GitHub connected keeps the link and the plain tooltip", async () => {
        mockStatus.mockResolvedValue({ kind: "github_not_connected" });
        renderBlock([delivery(1)]);

        await act(async () => {
            fireEvent.mouseEnter(prLinks()[0]);
        });

        expect(prLinks()[0].getAttribute("href")).toBe(
            "https://github.com/genos-tech/genos-api/pull/1"
        );
        expect(screen.queryByTestId("pr-card")).toBeNull();
    });

    it("with no session, hovering sends nothing", async () => {
        renderBlock([delivery(1)], null);

        await act(async () => {
            fireEvent.mouseEnter(prLinks()[0]);
        });

        expect(mockStatus).not.toHaveBeenCalled();
    });

    it("a delivery with no PR has no link and nothing to hover", async () => {
        renderBlock([delivery(1, { pr_url: null, pr_number: null, state: "branch" })]);

        expect(screen.queryAllByRole("link")).toHaveLength(0);
        expect(screen.queryByTestId("tooltip")).toBeNull();
        expect(mockStatus).not.toHaveBeenCalled();
    });
});
