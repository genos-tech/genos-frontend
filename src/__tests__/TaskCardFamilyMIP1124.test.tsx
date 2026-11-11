/**
 * MIP-1124: one task component family (`TaskCard`, `TaskListItem`) for the
 * board, the mobile list and the dashboard. jsdom cannot measure layout (the
 * heights were measured in a browser, see the evidence page), so these pin the
 * rules that produce them and the behavior that must survive the migration.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { SprintBoardCard } from "../features/tasks/components/board/SprintBoardCard";
import {
    TaskCard,
    TaskCardFrame,
    TaskListItem,
    TaskListPanel,
} from "../features/tasks/components/card";
import { AssignedMilestoneCard } from "../features/tasks/components/dashboard/AssignedMilestoneCard";
import { DashboardTaskRow } from "../features/tasks/components/dashboard/DashboardTaskRow";
import { StatusLabel } from "../features/tasks/components/meta/StatusLabel";
import {
    PRIORITY_NAMES,
    priorityTone,
    STATUS_NAMES,
    statusTone,
    toneCss,
} from "../features/tasks/meta/taskTone";
import { MobileTaskList } from "../features/tasks/MobileTaskList";
import { Milestone } from "../features/tasks/sprint-milestone/types";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8");

const task = (over: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({
        id: "1",
        displayId: "MIP-1",
        title: "Card title",
        status: "Open",
        priority: null,
        effortLevel: null,
        tags: [],
        projectId: 1,
        parentTaskId: null,
        isMilestone: false,
        assigneeId: null,
        assigneeName: "",
        dueDate: null,
        daysLeft: null,
        sprintId: null,
        ...over,
    }) as unknown as TaskTableProps;

const milestone = (over: Partial<Milestone> = {}): Milestone =>
    ({
        milestoneId: 7,
        taskId: 70,
        displayId: "MIP-70",
        projectId: 1,
        teamId: 1,
        sprintId: null,
        title: "Milestone title",
        description: [],
        status: "WIP",
        priority: "High",
        startDate: null,
        dueDate: null,
        tags: [],
        assignees: [],
        tasksTotal: 4,
        tasksClosed: 1,
        ...over,
    }) as unknown as Milestone;

const withContext = (node: React.ReactNode) => (
    <AvatarContextProvider
        value={{
            myself: { userId: "me", userName: "Me" } as unknown as UserProps,
            setMyself: () => {},
            teamMemberProfiles: {},
            setTeamMemberProfiles: () => {},
            socket: null,
            useCM: {} as never,
            useUISM: {} as never,
        }}
    >
        <CssVarsProvider>{node}</CssVarsProvider>
    </AvatarContextProvider>
);

const inDnd = (ui: React.ReactNode) =>
    withContext(
        <DragDropContext onDragEnd={() => {}}>
            <Droppable droppableId="col">
                {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                        {ui}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );

// The status mark a surface drew: the icon's test id and the color it was given.
const marks = (container: HTMLElement) =>
    [...container.querySelectorAll('span[aria-hidden="true"]')]
        .filter((el) => (el as HTMLElement).style.getPropertyValue("--Icon-color"))
        .map((el) => {
            const wrapper = el as HTMLElement;
            const icon = wrapper.querySelector("svg")?.getAttribute("data-testid");
            return `${icon}|${wrapper.style.getPropertyValue("--Icon-color")}`;
        });

const reference = (status: string) => {
    const { container, unmount } = render(
        <CssVarsProvider>
            <StatusLabel status={status} />
        </CssVarsProvider>
    );
    const out = marks(container);
    unmount();
    return out[0];
};

describe("one status icon and color per status, on every surface", () => {
    it("the six statuses are six different icons in the reference", () => {
        const icons = STATUS_NAMES.map((s) => reference(s).split("|")[0]);
        expect(new Set(icons).size).toBe(STATUS_NAMES.length);
    });

    it.each(STATUS_NAMES)("%s: card, row, compact row, dashboard row, milestone card", (s) => {
        const expected = reference(s);
        expect(expected.split("|")[1]).toBe(toneCss(statusTone(s)).text);

        const surfaces: Record<string, React.ReactNode> = {
            card: <TaskCard showStatus task={task({ status: s })} />,
            row: <TaskListItem task={task({ status: s })} onOpen={() => {}} />,
            compact: (
                <TaskListItem task={task({ status: s })} variant="compact" onOpen={() => {}} />
            ),
            dashboard: (
                <DashboardTaskRow
                    sprintName={null}
                    task={{ ...task({ status: "Open" }), effectiveStatus: s }}
                    onClick={() => {}}
                />
            ),
            milestone: (
                <AssignedMilestoneCard
                    milestone={milestone({ status: s })}
                    sprintName={null}
                    onOpen={() => {}}
                />
            ),
        };
        for (const [name, node] of Object.entries(surfaces)) {
            const { container, unmount } = render(withContext(node));
            expect(marks(container), name).toEqual([expected]);
            unmount();
        }
    });

    it.each(["Open", "WIP", "Blocked", "Pending"])("%s: the mobile list", (s) => {
        const expected = reference(s);
        const { container } = render(
            withContext(
                <MobileTaskList
                    usePM={{ currentProject: { projectId: 1 } } as never}
                    useTM={
                        {
                            allTasks: [task({ status: s })],
                            setCurrentPreviewTaskId: vi.fn(),
                            setIsTaskPreviewVisible: vi.fn(),
                        } as never
                    }
                />
            )
        );
        expect(marks(container)).toEqual([expected]);
    });

    it("the board card shows no status: its column says it", () => {
        const { container } = render(
            inDnd(
                <SprintBoardCard
                    columnId="open"
                    index={0}
                    myself={{} as UserProps}
                    task={task()}
                    teamMemberProfiles={{}}
                />
            )
        );
        expect(marks(container)).toEqual([]);
    });
});

// MIP-926 kept the board card and the milestone card on the table's priority list
// (a local map had "Medium", which is not a priority). They now both draw the
// table's PriorityIcon, so that contract is pinned here (it replaces
// PriorityChipCards.test.tsx, which pinned the old filled chip).
const priorityCards = {
    "sprint board card": (p: string | null) =>
        inDnd(
            <SprintBoardCard
                columnId="open"
                index={0}
                myself={{} as UserProps}
                task={task({ priority: p })}
                teamMemberProfiles={{}}
            />
        ),
    "task card": (p: string | null) => withContext(<TaskCard task={task({ priority: p })} />),
    "assigned milestone card": (p: string | null) =>
        withContext(
            <AssignedMilestoneCard
                milestone={milestone({ priority: p })}
                sprintName={null}
                onOpen={() => {}}
            />
        ),
};

describe.each(Object.entries(priorityCards))("priority on the %s", (_name, renderCard) => {
    it.each(PRIORITY_NAMES)("%s is the shared icon in its tone, with its name", (p) => {
        const { container } = render(renderCard(p));
        const icon = screen.getByRole("img", { name: p });
        expect(icon.style.color).toBe(toneCss(priorityTone(p)).text);
        // An icon, not a filled chip carrying the word.
        expect(container.textContent).not.toContain(p);
    });

    it("an unset or unknown priority draws nothing, and the card still renders", () => {
        for (const p of [null, "", "Medium", "Urgent"]) {
            const { unmount } = render(renderCard(p));
            expect(screen.getByText(/Card title|Milestone title/)).toBeTruthy();
            expect(screen.queryByRole("img", { name: /Medium|Urgent/ })).toBeNull();
            expect(screen.queryByTestId(/^PriorityBars/)).toBeNull();
            unmount();
        }
    });
});

describe("heights, radius and type come from tokens", () => {
    it("a row is the density height", () => {
        const { container } = render(
            withContext(<TaskListItem task={task()} onOpen={() => {}} />)
        );
        const css = cssOf(container.querySelector('[data-testid="task-list-item"]')!);
        expect(css).toContain("height: var(--g-row)");
        expect(source("features/tasks/components/card/TaskListItem.tsx")).toContain(
            "height: g.row.current"
        );
    });

    it("the card surface is radius.md, the surface role and one border", () => {
        const { container } = render(withContext(<TaskCard task={task()} />));
        const css = cssOf(container.querySelector('[data-testid="task-card"]')!);
        expect(css).toContain("border-radius: var(--g-radius-md)");
        expect(css).toContain("var(--g-surface)");
        expect(css).toContain("var(--g-border)");
        expect(css).not.toMatch(/box-shadow:\s*0 /);
    });

    it("the family has no literal color, shadow or font size, and no isDark", () => {
        const dir = resolve(srcDir, "features/tasks/components/card");
        for (const file of readdirSync(dir)) {
            const text = readFileSync(resolve(dir, file), "utf8");
            const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
            // The milestone flag's orange is the one named constant.
            const hexes = stripped.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
            expect(
                hexes.filter((h) => h !== "#f97316"),
                file
            ).toEqual([]);
            expect(stripped, file).not.toMatch(
                /rgba?\(|isDark|useColorScheme|backdropFilter|fontWeight:\s*[7-9]00/
            );
        }
    });
});

describe("TaskCard keeps what the old cards did", () => {
    it("onOpen: click and Enter/Space open it, as a button", () => {
        const onOpen = vi.fn();
        render(withContext(<TaskCard task={task()} onOpen={onOpen} />));
        const card = screen.getByRole("button", { name: "Card title" });
        fireEvent.click(card);
        fireEvent.keyDown(card, { key: "Enter" });
        fireEvent.keyDown(card, { key: " " });
        fireEvent.keyDown(card, { key: "a" });
        expect(onOpen).toHaveBeenCalledTimes(3);
    });

    it("copying the id does not also open the task", async () => {
        const onOpen = vi.fn();
        Object.assign(navigator, {
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
        render(withContext(<TaskCard task={task()} onOpen={onOpen} />));
        fireEvent.click(screen.getByText("MIP-1"));
        expect(onOpen).not.toHaveBeenCalled();
        expect((navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
            "MIP-1"
        );
    });

    it("a non-copyable id is a bare span (cheap)", () => {
        const source = readFileSync(
            resolve(srcDir, "features/tasks/components/card/parts.tsx"),
            "utf8"
        );
        expect(source).toMatch(
            /copyable && real \?[\s\S]{0,40}<CopyableId[\s\S]{0,80}<Box component="span"/
        );
    });

    it("no assignee says Unassigned; three tags then +N; the due text follows the board's wording", () => {
        const tag = (n: string) => ({ tagName: n, tagColor: "#999", tagTextColor: "#000" });
        render(
            withContext(
                <TaskCard
                    task={task({
                        tags: ["a", "b", "c", "d", "e"].map(tag),
                        dueDate: "2000-01-01",
                    })}
                />
            )
        );
        expect(screen.getByText("Unassigned")).toBeTruthy();
        expect(screen.getByText("c")).toBeTruthy();
        expect(screen.queryByText("d")).toBeNull();
        expect(screen.getByText("+2")).toBeTruthy();
        expect(screen.getByText("Expired").closest("[data-tone]")?.getAttribute("data-tone")).toBe(
            "overdue"
        );
    });

    it("an empty due date says so, unless the surface asks it not to", () => {
        const { unmount } = render(withContext(<TaskCard task={task()} />));
        expect(screen.getByText("No due date")).toBeTruthy();
        unmount();
        render(withContext(<TaskCard dueWhenEmpty={false} task={task()} />));
        expect(screen.queryByText("No due date")).toBeNull();
    });

    it("a milestone gets the flag", () => {
        render(withContext(<TaskCard task={task({ isMilestone: true })} />));
        expect(screen.getByTestId("MilestoneFlag")).toBeTruthy();
    });

    it("the frame cannot be re-styled: sx, style and className are dropped (a Tooltip hands them down)", () => {
        const props = {
            sx: { padding: 0, display: "block" },
            style: { padding: 0 },
            className: "x",
        };
        const { container } = render(
            withContext(<TaskCardFrame {...(props as object)}>body</TaskCardFrame>)
        );
        const el = container.querySelector('[data-testid="task-card"]') as HTMLElement;
        expect(el.className).not.toContain("x ");
        expect(el.style.padding).toBe("");
        expect(cssOf(el)).toContain("display: flex");
    });
});

describe("board card wrapper", () => {
    it("clicking the card calls onTaskClick; hover is CSS, not state", () => {
        const onTaskClick = vi.fn();
        render(
            inDnd(
                <SprintBoardCard
                    columnId="open"
                    index={0}
                    myself={{} as UserProps}
                    task={task()}
                    teamMemberProfiles={{}}
                    onTaskClick={onTaskClick}
                />
            )
        );
        fireEvent.click(screen.getByText("Card title"));
        expect(onTaskClick).toHaveBeenCalledTimes(1);
        expect(source("features/tasks/components/board/SprintBoardCard.tsx")).not.toMatch(
            /useState|onMouseEnter|onMouseLeave/
        );
    });

    it("a Closed card hides the due date; an open one shows it", () => {
        const { unmount } = render(
            inDnd(
                <SprintBoardCard
                    columnId="open"
                    index={0}
                    myself={{} as UserProps}
                    task={task({ status: "Closed" })}
                    teamMemberProfiles={{}}
                />
            )
        );
        expect(screen.queryByText("No due date")).toBeNull();
        unmount();
        render(
            inDnd(
                <SprintBoardCard
                    columnId="open"
                    index={0}
                    myself={{} as UserProps}
                    task={task()}
                    teamMemberProfiles={{}}
                />
            )
        );
        expect(screen.getByText("No due date")).toBeTruthy();
    });
});

describe("TaskListItem", () => {
    it("opens on click and Enter, and the sprint column only exists when asked for", () => {
        const onOpen = vi.fn();
        const { rerender } = render(
            withContext(
                <TaskListPanel>
                    <TaskListItem task={task()} onOpen={onOpen} />
                </TaskListPanel>
            )
        );
        const row = screen.getByTestId("task-list-item");
        fireEvent.click(row);
        fireEvent.keyDown(row, { key: "Enter" });
        expect(onOpen).toHaveBeenCalledTimes(2);
        expect(screen.queryByTestId("sprint-chip")).toBeNull();
        rerender(
            withContext(
                <TaskListPanel>
                    <TaskListItem sprintName={null} task={task()} onOpen={onOpen} />
                </TaskListPanel>
            )
        );
        expect(screen.getByTestId("sprint-chip").textContent).toBe("No Sprint");
    });

    it("on a phone the row's status is its icon, but the word stays for screen readers", () => {
        const { container } = render(
            withContext(<TaskListItem task={task({ status: "Blocked" })} onOpen={() => {}} />)
        );
        const word = container.querySelector("[data-status-word]") as HTMLElement;
        expect(word.textContent).toBe("Blocked");
        const css = cssOf(word.parentElement!.parentElement as HTMLElement);
        expect(css).toContain("data-status-word");
        expect(css).toContain("clip-path");
        expect(css).not.toMatch(/data-status-word[^}]*display:\s*none/);
    });

    it("compact: status icon, title and the due date only", () => {
        render(
            withContext(
                <TaskListItem
                    task={task({ dueDate: "2026-01-02", priority: "High", isMilestone: false })}
                    variant="compact"
                    onOpen={() => {}}
                />
            )
        );
        expect(screen.queryByText("MIP-1")).toBeNull();
        expect(screen.queryByRole("img", { name: "High" })).toBeNull();
        expect(screen.getByText("2026-01-02")).toBeTruthy();
    });
});

describe("mobile list", () => {
    it("shows open tasks only and a tap opens the preview", () => {
        const setCurrentPreviewTaskId = vi.fn();
        const setIsTaskPreviewVisible = vi.fn();
        render(
            withContext(
                <MobileTaskList
                    usePM={{ currentProject: { projectId: 1 } } as never}
                    useTM={
                        {
                            allTasks: [
                                task({ id: "1", title: "Open one" }),
                                task({ id: "2", title: "Closed one", status: "Closed" }),
                                task({ id: "3", title: "Gone", status: "Deleted" }),
                                task({ id: "4", title: "A child", parentTaskId: "1" }),
                            ],
                            setCurrentPreviewTaskId,
                            setIsTaskPreviewVisible,
                        } as never
                    }
                />
            )
        );
        expect(screen.getByText("Open one")).toBeTruthy();
        for (const hidden of ["Closed one", "Gone", "A child"]) {
            expect(screen.queryByText(hidden)).toBeNull();
        }
        fireEvent.click(screen.getByText("Open one"));
        expect(setCurrentPreviewTaskId).toHaveBeenCalledWith(1);
        expect(setIsTaskPreviewVisible).toHaveBeenCalledWith(true);
    });
});

describe("the old hand-styled task markup is gone from the migrated surfaces", () => {
    it.each([
        "features/tasks/components/board/SprintBoardCard.tsx",
        "features/tasks/MobileTaskList.tsx",
        "features/tasks/components/dashboard/DashboardTaskRow.tsx",
        "features/tasks/components/dashboard/AssignedMilestoneCard.tsx",
        "features/tasks/components/MilestoneCardBody.tsx",
    ])("%s has no literal color, isDark or gradient", (file) => {
        const text = source(file)
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/.*$/gm, "");
        expect(text).not.toMatch(
            /#[0-9a-fA-F]{3,8}\b|rgba?\(|isDark|useColorScheme|--gp-|gradient/
        );
    });
});
