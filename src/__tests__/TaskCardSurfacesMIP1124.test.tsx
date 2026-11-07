/**
 * MIP-1124 part 2: the chat id chip, the mention hover card, the task info pill,
 * the identity row and the agent plan row are the task family's pieces, not
 * their own chips. One status icon and color per status on each, the contents
 * the hover card always had, and the behavior of the pill.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { ApprovalCard } from "../features/agentQA/ApprovalCard";
import { BubbleUserName } from "../features/chat/components/bubbles/BubbleUserName";
import { StatusLabel } from "../features/tasks/components/meta/StatusLabel";
import { TaskIdentityRow } from "../features/tasks/components/TaskIdentityRow";
import { TaskInfoPill } from "../features/tasks/components/TaskInfoPill";
import { TaskMentionHoverCard } from "../features/tasks/components/TaskMentionHoverCard";
import {
    PRIORITY_NAMES,
    priorityTone,
    STATUS_NAMES,
    toneCss,
} from "../features/tasks/meta/taskTone";
import type { UserProps } from "../types/admin";
import type { TaskProps, TaskStatusProps } from "../types/tasks";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8");

// Hover card dependencies: the live fetch and the two contexts.
const hover = vi.hoisted(() => ({
    result: { kind: "error" } as { kind: "ok"; payload: unknown } | { kind: "error" },
    tasks: [] as unknown[],
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../context/HashMentionDataContext", () => ({
    useHashMentionData: () => ({
        myself: { userId: "me", teamId: "t" },
        tasks: hover.tasks,
        projects: [{ projectId: 1, projectName: "Website" }],
    }),
}));
vi.mock("../features/tasks/services/taskStatusCache", () => ({
    getCachedOrFetchTaskStatus: () => Promise.resolve(hover.result),
}));

const withContext = (node: React.ReactNode) => (
    <AvatarContextProvider
        value={{
            myself: { userId: "me", userName: "Me" } as unknown as UserProps,
            setMyself: () => {},
            teamMemberProfiles: {
                "u-1": { userId: "u-1", userName: "Aiko Tanaka" } as unknown as UserProps,
            },
            setTeamMemberProfiles: () => {},
            socket: null,
            useCM: {} as never,
            useUISM: {} as never,
        }}
    >
        <CssVarsProvider>{node}</CssVarsProvider>
    </AvatarContextProvider>
);

const mark = (container: HTMLElement) =>
    [...container.querySelectorAll('span[aria-hidden="true"]')]
        .filter((el) => (el as HTMLElement).style.getPropertyValue("--Icon-color"))
        .map(
            (el) =>
                `${el.querySelector("svg")?.getAttribute("data-testid")}|${(el as HTMLElement).style.getPropertyValue("--Icon-color")}`
        );

const reference = (status: string) => {
    const { container, unmount } = render(
        <CssVarsProvider>
            <StatusLabel status={status} />
        </CssVarsProvider>
    );
    const out = mark(container);
    unmount();
    return out[0];
};

const statusMeta = (status: string) => ({ status }) as unknown as TaskStatusProps;

describe("one status icon and color per status on the part-2 surfaces", () => {
    it.each(STATUS_NAMES)("%s: identity row, info pill, chat header, hover card", async (s) => {
        const expected = reference(s);
        const surfaces: Record<string, React.ReactNode> = {
            identityRow: (
                <TaskIdentityRow
                    status={statusMeta(s)}
                    task={{ displayId: "TP-1" }}
                    title="A task"
                />
            ),
            infoPill: (
                <TaskInfoPill
                    task={
                        {
                            id: 1,
                            displayId: "TP-1",
                            title: "A task",
                            status: { status: s },
                        } as unknown as TaskProps
                    }
                    onOpen={() => {}}
                />
            ),
            chatHeader: (
                <BubbleUserName
                    chatType={3}
                    displayId="TP-1"
                    dtSent="Jul 20, 09:12"
                    isSent={false}
                    isSimpleBubble={false}
                    isThread={false}
                    sender={{ userId: "x", userName: "x" } as UserProps}
                    taskId={1}
                    taskStatus={s}
                    tsSent="2026-07-20T09:12:00Z"
                    tsUpdated="2026-07-20T09:12:00Z"
                />
            ),
        };
        for (const [name, node] of Object.entries(surfaces)) {
            const { container, unmount } = render(withContext(node));
            expect(mark(container), name).toEqual([expected]);
            unmount();
        }

        hover.tasks = [{ id: "5", displayId: "TP-5", title: "Mention", status: s, tags: [] }];
        hover.result = { kind: "error" };
        const { container } = render(
            withContext(
                <TaskMentionHoverCard displayId="TP-5" projectId="1" taskId="5" title="Mention" />
            )
        );
        await waitFor(() => expect(mark(container)).toEqual([expected]));
    });

    it("the agent plan shows no status (a plan has none yet) but keeps its priority as the icon", () => {
        const pending = {
            step: 1,
            tool_name: "create_task_plan",
            arguments: {
                tasks: [{ title: "Design review", priority: "High", effort_level: "Large" }],
            },
            approval_token: "t",
            run_id: "r",
        };
        const { container } = render(
            withContext(
                <ApprovalCard
                    approveLabel="Approve"
                    pending={pending}
                    rejectLabel="Reject"
                    titleText="Approval"
                    onApprove={vi.fn()}
                    onReject={vi.fn()}
                />
            )
        );
        expect(mark(container)).toEqual([]);
        const icon = screen.getByText("High").closest("span[style]") as HTMLElement;
        expect(icon.style.color).toBe(toneCss(priorityTone("High")).text);
        // Effort is plain words in the neutral color.
        expect(cssOf(screen.getByText("Large"))).toContain("var(--g-text-secondary)");
    });
});

describe("agent plan rows", () => {
    const render1 = (tasks: unknown[], milestone?: unknown) =>
        render(
            withContext(
                <ApprovalCard
                    approveLabel="Approve"
                    pending={{
                        step: 1,
                        tool_name: "create_task_plan",
                        arguments: { milestone, tasks },
                        approval_token: "t",
                        run_id: "r",
                    }}
                    rejectLabel="Reject"
                    titleText="Approval"
                    onApprove={vi.fn()}
                    onReject={vi.fn()}
                />
            )
        );

    it.each(PRIORITY_NAMES)("%s is the shared priority icon with its name", (p) => {
        render1([{ title: "Row", priority: p }]);
        expect(screen.getByText(p)).toBeTruthy();
        expect(screen.getByTestId(/^PriorityBars|PriorityHigh/)).toBeTruthy();
    });

    it("a priority the product does not have stays visible as a text chip, never dropped", () => {
        render1([{ title: "Row", priority: "Urgent" }]);
        expect(screen.getByText("Urgent")).toBeTruthy();
        expect(screen.queryByTestId(/^PriorityBars/)).toBeNull();
    });

    it("the milestone header has the family's flag, and the file has no palette or isDark", () => {
        render1([{ title: "Row" }], { title: "Beta" });
        expect(screen.getByTestId("MilestoneFlag")).toBeTruthy();
        const text = source("features/agentQA/approval/TaskPlanPreview.tsx");
        expect(text).not.toMatch(/purplePalette|isDark|#[0-9a-fA-F]{3,8}\b/);
    });
});

describe("TaskMentionHoverCard keeps its contents", () => {
    const full = {
        id: 5,
        displayId: "TP-5",
        title: "Mention me",
        isMilestone: true,
        project: { projectName: "Website" },
        status: { status: "WIP" },
        priority: { priority: "Critical" },
        effortLevel: { level: "Large" },
        assignee: { userId: "u-1", userName: "Aiko Tanaka" },
        reporter: { userName: "Ben Ito" },
        startDate: "2026-07-01",
        dueDate: "2000-01-01",
        tags: ["a", "b", "c", "d", "e", "f", "g", "h"].map((n) => ({
            tagName: `t-${n}`,
            tagColor: "#999",
            tagTextColor: "#000",
        })),
    };

    it("header, project, status, priority, effort, assignee, due, reporter, start, six tags and +N", async () => {
        hover.tasks = [];
        hover.result = { kind: "ok", payload: full };
        render(
            withContext(
                <TaskMentionHoverCard
                    displayId="TP-5"
                    projectId="1"
                    taskId="5"
                    title="Mention me"
                />
            )
        );
        await waitFor(() => expect(screen.getByText("WIP")).toBeTruthy());
        expect(screen.getByText("TP-5 · Mention me")).toBeTruthy();
        expect(screen.getByText("Website")).toBeTruthy();
        expect(screen.getByTestId("MilestoneFlag")).toBeTruthy();
        expect(screen.getByText("Critical")).toBeTruthy();
        expect(screen.getByText("Large")).toBeTruthy();
        expect(screen.getByText("Aiko Tanaka")).toBeTruthy();
        expect(screen.getByText("Expired")).toBeTruthy();
        expect(screen.getByText(/Reported by Ben Ito/)).toBeTruthy();
        expect(screen.getByText(/Started/)).toBeTruthy();
        expect(screen.getByText("t-f")).toBeTruthy();
        expect(screen.queryByText("t-g")).toBeNull();
        expect(screen.getByText("+2")).toBeTruthy();
    });

    it("says Status unavailable when nothing is known and the fetch failed", async () => {
        hover.tasks = [];
        hover.result = { kind: "error" };
        render(
            withContext(
                <TaskMentionHoverCard displayId="TP-9" projectId="1" taskId="9" title="Gone" />
            )
        );
        await waitFor(() => expect(screen.getByText("Status unavailable")).toBeTruthy());
        expect(screen.getByText("TP-9 · Gone")).toBeTruthy();
    });

    it("its surface is the raised surface role, the medium radius and shadow, no palette", () => {
        const text = source("features/tasks/components/TaskMentionHoverCard.tsx");
        expect(text).toContain("g.surface.raised");
        expect(text).toContain("g.radius.md");
        expect(text).toContain("g.shadow.md");
        expect(text).not.toMatch(
            /purplePalette|isDark|useColorScheme|#[0-9a-fA-F]{3,8}\b|alpha\(/
        );
    });
});

describe("TaskInfoPill", () => {
    const task = {
        id: 7,
        displayId: "TP-7",
        title: "Open me",
        status: { status: "Blocked" },
    } as unknown as TaskProps;

    it("is one button: opens the task, named with the id and title", () => {
        const onOpen = vi.fn();
        render(withContext(<TaskInfoPill task={task} onOpen={onOpen} />));
        const pill = screen.getByRole("button", { name: /TP-7/ });
        expect(pill.getAttribute("aria-label")).toContain("Open me");
        expect(screen.getByText("Open me")).toBeTruthy();
        fireEvent.click(pill);
        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it("leaves out the status when there is none, and the title when there is none", () => {
        const { container } = render(
            withContext(
                <TaskInfoPill
                    task={
                        {
                            id: 8,
                            displayId: "TP-8",
                            title: "",
                            status: null,
                        } as unknown as TaskProps
                    }
                    onOpen={() => {}}
                />
            )
        );
        expect(mark(container)).toEqual([]);
        expect(screen.getByText("TP-8")).toBeTruthy();
    });

    it("is flat, the control height, with a tooltip hand-down that cannot restyle it", () => {
        render(withContext(<TaskInfoPill task={task} onOpen={() => {}} />));
        const css = cssOf(screen.getByTestId("task-pill"));
        expect(css).toContain("height: var(--g-control-md)");
        expect(css).toContain("var(--g-surface)");
        expect(css).toContain("var(--g-border)");
        expect(css).toContain("border-radius: var(--g-radius-md)");
        // The tooltip chip's own background (the old purple menu color) is not on it.
        expect(css).not.toContain("--gp-");
        expect(css).not.toMatch(/box-shadow|translateY|transition:\s*all/);
    });

    it("TaskInfoPill takes only the task and onOpen: the callers' style tokens are gone", () => {
        for (const file of [
            "features/chat/components/headers/ThreadChatPaneHeader.tsx",
            "features/notes/common/components/NoteHeaderActions.tsx",
        ]) {
            expect(source(file)).not.toMatch(/<TaskInfoPill[^>]*(styles=|isDark=)/s);
        }
    });
});

describe("chat id chip stays cheap", () => {
    it("is a bare span: no tooltip, no copy state, no accent chip", () => {
        const { container } = render(
            withContext(
                <BubbleUserName
                    chatType={3}
                    displayId="TP-139"
                    dtSent="x"
                    isSent={false}
                    isSimpleBubble={false}
                    isThread={false}
                    sender={{ userId: "x", userName: "x" } as UserProps}
                    taskId={139}
                    taskStatus="Open"
                    tsSent="2026-07-20T09:12:00Z"
                    tsUpdated="2026-07-20T09:12:00Z"
                />
            )
        );
        const id = screen.getByText("TP-139");
        expect(id.tagName).toBe("SPAN");
        expect(id.getAttribute("aria-describedby")).toBeNull();
        expect(cssOf(id)).toContain("var(--g-text-tertiary)");
        expect(cssOf(id)).not.toContain("accent");
        expect(container.querySelector("[role=tooltip]")).toBeNull();
        expect(source("features/chat/components/bubbles/BubbleUserName.tsx")).not.toMatch(
            /IdChip|useState|g\.accent/
        );
    });
});

describe("identity row", () => {
    it("flag only for a milestone; copyable quiet id; the title in the title style", () => {
        const { rerender } = render(
            withContext(
                <TaskIdentityRow
                    status={statusMeta("Open")}
                    task={{ displayId: "TP-3" }}
                    title="Pick me"
                />
            )
        );
        expect(screen.queryByTestId("MilestoneFlag")).toBeNull();
        expect(cssOf(screen.getByText("TP-3"))).toContain("var(--g-text-tertiary)");
        expect(screen.getByText("Pick me")).toBeTruthy();
        rerender(
            withContext(
                <TaskIdentityRow
                    isMilestone
                    status={statusMeta("Open")}
                    task={{ displayId: "TP-3" }}
                    title="Pick me"
                />
            )
        );
        expect(screen.getByTestId("MilestoneFlag")).toBeTruthy();
    });
});
