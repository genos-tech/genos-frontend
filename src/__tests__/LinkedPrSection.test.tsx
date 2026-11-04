/**
 * The task preview's "Linked PR" section sends a PR detail request at mount
 * only for a PR whose state is live (MIP-998).
 *
 * It used to draw a full `LinkedPrCard` per PR link, and every card fetched
 * the detail (three GitHub calls on the server) as it mounted: a task with a
 * dozen merged PRs sent a dozen at once. The task's deliveries already say
 * which PRs are merged or closed, so those are one-line rows that fetch the
 * detail on hover; every other PR keeps the full card.
 */

import type { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCachedOrFetchPrStatus } from "../features/integrations/services/prStatusCache";
import { LinkedPrSection } from "../features/tasks/components/contents/LinkedPrSection";
import { loadTaskDeliveries } from "../features/tasks/services/loadTaskDeliveries";
import type { UserProps } from "../types/admin";
import type { TaskDeliveryProps } from "../types/tasks";

vi.mock("../features/tasks/services/loadTaskDeliveries", () => ({
    loadTaskDeliveries: vi.fn(),
}));
vi.mock("../features/integrations/services/prStatusCache", () => ({
    getCachedOrFetchPrStatus: vi.fn(),
}));
// The full card is its own component: here it only has to show up, and say for which URL.
vi.mock("../features/integrations/components/LinkedPrCard", () => ({
    LinkedPrCard: ({ url }: { url: string }) => <div data-testid="full-card" data-url={url} />,
}));
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

const mockDeliveries = vi.mocked(loadTaskDeliveries);
const mockStatus = vi.mocked(getCachedOrFetchPrStatus);

const myself = { teamId: "team-1" } as unknown as UserProps;
const prUrl = (n: number) => `https://github.com/acme/rocket/pull/${n}`;

const delivery = (n: number, state: TaskDeliveryProps["state"], over = {}): TaskDeliveryProps => ({
    delivery_id: n,
    repo: "acme/rocket",
    branch: `GEN-42-${n}`,
    pr_url: prUrl(n),
    pr_number: n,
    pr_title: `Title ${n}`,
    state,
    merged_at: state === "merged" ? "2026-11-03T10:00:00Z" : null,
    source: "webhook",
    ...over,
});

const links = (...urls: string[]) => urls.map((url, i) => ({ id: `l${i}`, url, title: "x" }));

const detailFor = (n: number, pull: Record<string, unknown>) =>
    ({
        kind: "ok",
        payload: {
            pull: {
                number: n,
                title: `Live ${n}`,
                base: { repo: { full_name: "acme/rocket" } },
                ...pull,
            },
            combined_status: null,
            check_runs: null,
        },
    }) as never;

const mount = async (
    urls: string[],
    rows: TaskDeliveryProps[] | Promise<TaskDeliveryProps[]>,
    opts: { taskId?: number | null; token?: string | null } = {}
) => {
    mockDeliveries.mockReturnValue(Promise.resolve(rows));
    const props = {
        accessToken: opts.token === undefined ? "tok" : opts.token,
        isDark: false,
        links: links(...urls),
        myself,
        taskId: opts.taskId === undefined ? 42 : opts.taskId,
    };
    const view = render(
        <CssVarsProvider>
            <LinkedPrSection {...(props as never)} />
        </CssVarsProvider>
    );
    await act(async () => {});
    return { view, props };
};

const rowsOnPage = () => screen.queryAllByRole("link");
const cardsOnPage = () => screen.queryAllByTestId("full-card");

beforeEach(() => {
    mockDeliveries.mockReset();
    mockStatus.mockReset();
});

describe("LinkedPrSection: merged and closed PRs are rows that wait for hover", () => {
    it("a task whose PRs are all merged sends no PR detail request", async () => {
        await mount([prUrl(1), prUrl(2)], [delivery(1, "merged"), delivery(2, "merged")]);

        expect(rowsOnPage()).toHaveLength(2);
        expect(cardsOnPage()).toHaveLength(0);
        expect(mockStatus).not.toHaveBeenCalled();
        expect(mockDeliveries).toHaveBeenCalledTimes(1);
    });

    it("a row names the PR, its title and its state, and links to GitHub", async () => {
        await mount([prUrl(7)], [delivery(7, "merged")]);

        const row = rowsOnPage()[0];
        expect(row.getAttribute("href")).toBe(prUrl(7));
        expect(row.textContent).toContain("acme/rocket #7");
        expect(row.textContent).toContain("Title 7");
        expect(row.textContent).toContain("Merged");
    });

    it("a closed, unmerged PR is a row too, and says Closed", async () => {
        await mount([prUrl(3)], [delivery(3, "closed")]);

        expect(rowsOnPage()[0].textContent).toContain("Closed");
        expect(cardsOnPage()).toHaveLength(0);
        expect(mockStatus).not.toHaveBeenCalled();
    });

    it("the tooltip names the state only, never a CI claim, before the detail is loaded", async () => {
        await mount([prUrl(7)], [delivery(7, "merged")]);

        const tip = screen.getByTestId("tooltip").textContent ?? "";
        expect(tip).toContain("Merged");
        expect(tip).not.toMatch(/CI|checks/i);
    });

    it("hover asks once, and the rich card replaces the plain tooltip when it lands", async () => {
        mockStatus.mockResolvedValue(detailFor(7, { state: "closed", merged: true }));
        await mount([prUrl(7)], [delivery(7, "merged")]);

        await act(async () => {
            fireEvent.mouseEnter(rowsOnPage()[0]);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(mockStatus).toHaveBeenCalledWith("tok", prUrl(7));
        expect(screen.getByTestId("hover-card")).toBeTruthy();
    });

    it("focus alone asks (keyboard users)", async () => {
        mockStatus.mockResolvedValue(detailFor(7, { state: "closed", merged: true }));
        await mount([prUrl(7)], [delivery(7, "merged")]);

        await act(async () => {
            fireEvent.focus(rowsOnPage()[0]);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it("further hovers and focuses do not ask again", async () => {
        mockStatus.mockResolvedValue(detailFor(7, { state: "closed", merged: true }));
        await mount([prUrl(7)], [delivery(7, "merged")]);
        const row = rowsOnPage()[0];

        for (const fire of [fireEvent.focus, fireEvent.mouseEnter, fireEvent.focus]) {
            await act(async () => {
                fire(row);
            });
        }

        expect(mockStatus).toHaveBeenCalledTimes(1);
    });

    it("a failed lookup keeps the row and the state, shows no card, and is not retried", async () => {
        mockStatus.mockResolvedValue({ kind: "error" });
        await mount([prUrl(7)], [delivery(7, "merged")]);
        const row = rowsOnPage()[0];

        await act(async () => {
            fireEvent.mouseEnter(row);
        });
        await act(async () => {
            fireEvent.mouseEnter(row);
        });

        expect(mockStatus).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("hover-card")).toBeNull();
        expect(row.textContent).toContain("Merged");
    });

    it("the live detail wins over the delivery: a PR reopened since reads Open", async () => {
        mockStatus.mockResolvedValue(detailFor(3, { state: "open", merged: false, draft: false }));
        await mount([prUrl(3)], [delivery(3, "closed")]);

        await act(async () => {
            fireEvent.mouseEnter(rowsOnPage()[0]);
        });

        expect(rowsOnPage()[0].textContent).toContain("Open");
        expect(rowsOnPage()[0].textContent).not.toContain("Closed");
    });

    it("signed out: hovering sends nothing", async () => {
        await mount([prUrl(7)], [delivery(7, "merged")], { token: null });

        await act(async () => {
            fireEvent.mouseEnter(rowsOnPage()[0]);
        });

        expect(mockStatus).not.toHaveBeenCalled();
    });
});

describe("LinkedPrSection: everything else keeps its full card", () => {
    it("open, branch-only and unknown PRs get the full card, in the order of the links", async () => {
        await mount(
            [prUrl(1), prUrl(2), prUrl(3), prUrl(4), prUrl(5)],
            [
                delivery(1, "merged"),
                delivery(2, "open"),
                delivery(4, "branch", { pr_url: null }),
                delivery(5, "unknown"),
            ]
        );

        const order = Array.from(
            document.querySelectorAll("[data-testid='full-card'], a[href]")
        ).map((el) => el.getAttribute("data-url") ?? el.getAttribute("href"));
        expect(order).toEqual([prUrl(1), prUrl(2), prUrl(3), prUrl(4), prUrl(5)]);
        expect(rowsOnPage()).toHaveLength(1); // only #1 is a row
        expect(cardsOnPage().map((c) => c.getAttribute("data-url"))).toEqual([
            prUrl(2),
            prUrl(3),
            prUrl(4),
            prUrl(5),
        ]);
    });

    it("a PR pasted in the body that no delivery knows keeps its full card", async () => {
        await mount([prUrl(9)], [delivery(1, "merged")]);

        expect(cardsOnPage().map((c) => c.getAttribute("data-url"))).toEqual([prUrl(9)]);
        expect(rowsOnPage()).toHaveLength(0);
    });

    it("no deliveries, or a failed lookup (which resolves to none), means full cards as before", async () => {
        await mount([prUrl(1), prUrl(2)], []);

        expect(cardsOnPage()).toHaveLength(2);
        expect(rowsOnPage()).toHaveLength(0);
    });

    it("the same PR spelled differently is still matched (case, trailing slash)", async () => {
        await mount(["https://github.com/Acme/Rocket/pull/7/"], [delivery(7, "merged")]);

        expect(rowsOnPage()).toHaveLength(1);
        expect(cardsOnPage()).toHaveLength(0);
    });

    it("without a task id (the milestone preview) every PR keeps its full card and nothing is looked up", async () => {
        await mount([prUrl(1), prUrl(2)], [delivery(1, "merged")], { taskId: null });

        expect(cardsOnPage()).toHaveLength(2);
        expect(mockDeliveries).not.toHaveBeenCalled();
    });
});

describe("LinkedPrSection: when it draws", () => {
    it("draws nothing, not even full cards, until the deliveries have landed", async () => {
        let land!: (rows: TaskDeliveryProps[]) => void;
        const pending = new Promise<TaskDeliveryProps[]>((res) => {
            land = res;
        });
        const { view } = await mount([prUrl(1)], pending);

        expect(view.container.textContent).toBe("");
        expect(cardsOnPage()).toHaveLength(0);

        await act(async () => {
            land([delivery(1, "merged")]);
        });

        expect(view.container.textContent).toContain("Linked PR");
        expect(rowsOnPage()).toHaveLength(1);
    });

    it("a task without PR links draws nothing and looks nothing up", async () => {
        const { view } = await mount([], []);

        expect(view.container.textContent).toBe("");
        expect(mockDeliveries).not.toHaveBeenCalled();
    });

    it("switching to another task never shows the previous task's rows while it loads", async () => {
        const { view, props } = await mount([prUrl(1)], [delivery(1, "merged")]);
        expect(rowsOnPage()).toHaveLength(1);

        mockDeliveries.mockReturnValue(new Promise(() => {})); // the next task's answer is slow
        view.rerender(
            <CssVarsProvider>
                <LinkedPrSection
                    {...({ ...props, taskId: 43, links: links(prUrl(1)) } as never)}
                />
            </CssVarsProvider>
        );
        await act(async () => {});

        expect(view.container.textContent).toBe("");
        expect(mockStatus).not.toHaveBeenCalled();
    });

    it("asks for the deliveries once per task", async () => {
        const { view, props } = await mount([prUrl(1)], [delivery(1, "merged")]);
        view.rerender(
            <CssVarsProvider>
                <LinkedPrSection {...(props as never)} />
            </CssVarsProvider>
        );
        await act(async () => {});

        expect(mockDeliveries).toHaveBeenCalledTimes(1);
    });
});
