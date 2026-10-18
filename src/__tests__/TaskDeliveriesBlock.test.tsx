/**
 * MIP-701: the task page shows the task's stored delivery links (MIP-687
 * `TaskDelivery`) — repo, branch, PR and state — and flags a merged PR on
 * a task that isn't Closed. The auto-linked entries those rows duplicate
 * leave the Links list, but only from the display: they stay in
 * `taskContent.links`, which the PR column reads.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DynamicURLManager } from "../features/tasks/components/contents/base/sub/DynamicURLManager";
import {
    deliveryPrUrls,
    TaskDeliveriesBlock,
    TaskDeliveriesBlock,
} from "../features/tasks/components/contents/base/TaskDeliveriesBlock";
import { deliveryPrUrls } from "../features/tasks/utils/deliveryPrUrls";
import type { TaskDeliveryProps, TaskProps } from "../types/tasks";

const delivery = (overrides: Partial<TaskDeliveryProps>): TaskDeliveryProps => ({
    delivery_id: 1,
    repo: "genos-tech/genos-api",
    branch: "MIP-701",
    pr_url: "https://github.com/genos-tech/genos-api/pull/371",
    pr_number: 371,
    pr_title: "Task deliveries endpoint",
    state: "open",
    merged_at: null,
    source: "webhook",
    ...overrides,
});

const renderBlock = (deliveries: TaskDeliveryProps[], taskStatus = "WIP") =>
    render(
        <CssVarsProvider>
            <TaskDeliveriesBlock deliveries={deliveries} isDark={false} taskStatus={taskStatus} />
        </CssVarsProvider>
    );

describe("TaskDeliveriesBlock", () => {
    it("shows repo, branch, a linked PR and the state", () => {
        renderBlock([delivery({})]);
        expect(screen.getByText("Open")).toBeTruthy();
        expect(screen.getByText("genos-tech/genos-api")).toBeTruthy();
        expect(screen.getByText("MIP-701")).toBeTruthy();
        const link = screen.getByRole("link");
        expect(link.getAttribute("href")).toBe("https://github.com/genos-tech/genos-api/pull/371");
        expect(link.textContent).toBe("#371 Task deliveries endpoint");
    });

    it("labels every state, and a branch with no PR has no link", () => {
        renderBlock([
            delivery({ delivery_id: 1, state: "merged" }),
            delivery({ delivery_id: 2, state: "closed" }),
            delivery({ delivery_id: 3, state: "unknown", branch: null }),
            delivery({ delivery_id: 4, state: "branch", pr_url: null, pr_number: null }),
        ]);
        for (const label of ["Merged", "Closed", "Unknown", "Branch only"]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
        expect(screen.getByText("Branch not recorded")).toBeTruthy();
        // Count anchors, not link roles: an `<a>` without href has none.
        const rows = screen.getAllByTestId("task-delivery-row");
        expect(rows.map((r) => r.querySelectorAll("a").length)).toEqual([1, 1, 1, 0]);
    });

    it("flags a merged PR while the task is not Closed", () => {
        renderBlock([delivery({ state: "merged" })], "WIP");
        expect(screen.getByTestId("task-delivery-merged-not-closed").textContent).toContain(
            "Merged, but the task is still WIP"
        );
    });

    it("does not flag a merged PR on a Closed task, or an open one", () => {
        const { unmount } = renderBlock([delivery({ state: "merged" })], "Closed");
        expect(screen.queryByTestId("task-delivery-merged-not-closed")).toBeNull();
        unmount();
        renderBlock([delivery({ state: "open" })], "WIP");
        expect(screen.queryByTestId("task-delivery-merged-not-closed")).toBeNull();
    });

    it("renders nothing without rows", () => {
        const { container } = renderBlock([]);
        expect(container.querySelector("[data-testid=task-delivery-row]")).toBeNull();
    });
});

describe("Links list next to deliveries", () => {
    const PR = "https://github.com/genos-tech/genos-api/pull/371";
    const links: TaskProps["links"] = [
        { id: "a", url: PR, title: "auto PR", isGitHub: true, isAutoLinked: true },
        { id: "m", url: PR.replace("371", "372"), title: "hand PR", isGitHub: true },
        {
            id: "x",
            url: "https://GitHub.com/Genos-Tech/genos-api/pull/371",
            title: "hand dup",
            isGitHub: true,
        },
        // GitHub's `html_url` keeps the owner's casing; the stored
        // delivery url is lowercase.
        {
            id: "c",
            url: "https://github.com/Genos-Tech/Genos-API/pull/371",
            title: "auto PR cased",
            isGitHub: true,
            isAutoLinked: true,
        },
    ];

    const renderLinks = (setTaskContent = vi.fn()) => {
        render(
            <CssVarsProvider>
                <DynamicURLManager
                    setTaskContent={setTaskContent}
                    setTaskUpdated={() => {}}
                    taskContent={{ links } as TaskProps}
                    hiddenAutoLinkUrls={deliveryPrUrls([
                        delivery({}),
                        delivery({ delivery_id: 2, pr_url: PR.replace("371", "372") }),
                    ])}
                />
            </CssVarsProvider>
        );
        return setTaskContent;
    };

    it("hides only the auto-linked duplicate", () => {
        renderLinks();
        expect(screen.queryByText("auto PR")).toBeNull();
        expect(screen.queryByText("auto PR cased")).toBeNull();
        // Hand-added links stay — even one a delivery row repeats.
        expect(screen.getByText("hand PR")).toBeTruthy();
        expect(screen.getByText("hand dup")).toBeTruthy();
    });

    it("keeps the hidden entry in links when another link is deleted", () => {
        const setTaskContent = renderLinks();
        fireEvent.click(screen.getAllByTestId("DeleteIcon")[0].closest("button")!);
        const saved = setTaskContent.mock.calls[0][0].links.map((l: { id: string }) => l.id);
        expect(saved).toEqual(["a", "x", "c"]);
    });
});
