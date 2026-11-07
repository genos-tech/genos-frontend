/**
 * MIP-1124 part 3: the task graph's nodes, the Sprint Insights milestone strip
 * and the preview header's id are on the task component family. jsdom cannot
 * measure layout or computed colors (that was done in a browser, see the
 * evidence page), so these pin the rules that produce them and the behavior
 * that must survive: inline title editing, the status menu, the date editor,
 * the ghost's read-only click, the handles.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { TaskCardFrame } from "../features/tasks/components/card";
import { StatusLabel } from "../features/tasks/components/meta/StatusLabel";
import { PreviewTaskIdChip } from "../features/tasks/components/PreviewTaskIdChip";
import {
    MilestoneNodeCard,
    MilestoneNodeView,
} from "../features/tasks/diagram/components/MilestoneNodeCard";
import { TaskNodeCard, TaskNodeView } from "../features/tasks/diagram/components/TaskNodeCard";
import { DEPENDENCY_COLOR, HANDLE, TaskNodeData } from "../features/tasks/diagram/types";
import { NODE_WIDTH } from "../features/tasks/diagram/utils/layoutDiagram";
import {
    PRIORITY_NAMES,
    priorityTone,
    STATUS_NAMES,
    statusTone,
    toneCss,
} from "../features/tasks/meta/taskTone";
import { SprintMilestonesSection } from "../features/tasks/sprint-milestone/components/SprintMilestonesSection";
import type { Milestone } from "../features/tasks/sprint-milestone/types";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

// Handles need a React Flow node to belong to; here each is a marker carrying
// the props the canvas depends on (id, type, connectable, style).
vi.mock("@xyflow/react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@xyflow/react")>()),
    Handle: (p: {
        id: string;
        type: string;
        isConnectable?: boolean;
        style?: Record<string, unknown>;
    }) => (
        <i
            data-connectable={String(p.isConnectable)}
            data-handle={p.id}
            data-style={JSON.stringify(p.style)}
            data-type={p.type}
        />
    ),
}));

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8");
const code = (path: string) =>
    source(path)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

const NOOP = () => {};

const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const withContext = (node: React.ReactNode) => (
    <AvatarContextProvider
        value={{
            myself: { userId: "me", userName: "Me" } as unknown as UserProps,
            setMyself: NOOP,
            teamMemberProfiles: {},
            setTeamMemberProfiles: NOOP,
            socket: null,
            useCM: {} as never,
            useUISM: {} as never,
        }}
    >
        <CssVarsProvider>{node}</CssVarsProvider>
    </AvatarContextProvider>
);

const data = (
    over: Omit<Partial<TaskNodeData>, "task"> & { task?: Partial<TaskTableProps> } = {}
): TaskNodeData => {
    const { task, ...rest } = over;
    return {
        task: {
            id: 7,
            displayId: "MIP-7",
            title: "Node title",
            status: "Open",
            priority: null,
            assigneeId: null,
            assigneeName: "",
            startDate: null,
            dueDate: null,
            isMilestone: false,
            ...task,
        } as unknown as TaskTableProps,
        isRoot: false,
        isCurrentPreview: false,
        isMilestone: false,
        isExternal: false,
        closedDescendantCount: 0,
        totalDescendantCount: 0,
        openBlockerCount: 0,
        projectName: null,
        onChange: vi.fn(),
        onAddSubtask: vi.fn(),
        onDelete: vi.fn(),
        onOpenPreview: vi.fn(),
        ...rest,
    };
};

const frameOf = (container: HTMLElement) =>
    container.querySelector('[data-testid="task-card"]') as HTMLElement;

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

afterEach(() => {
    vi.restoreAllMocks();
});

describe("a status is one icon and one color on the graph nodes too", () => {
    it.each(STATUS_NAMES)("%s: task node, ghost, milestone node", (s) => {
        const expected = reference(s);
        expect(expected.split("|")[1]).toBe(toneCss(statusTone(s)).text);
        const nodes: Record<string, React.ReactNode> = {
            task: <TaskNodeView data={data({ task: { status: s } })} />,
            ghost: <TaskNodeView data={data({ isExternal: true, task: { status: s } })} />,
            milestone: (
                <MilestoneNodeView
                    data={data({ isMilestone: true, task: { status: s, isMilestone: true } })}
                />
            ),
        };
        for (const [name, node] of Object.entries(nodes)) {
            const { container, unmount } = render(withContext(node));
            expect(marks(container), name).toEqual([expected]);
            unmount();
        }
    });

    it("the status menu lists every status with the same mark, and picking one changes it", () => {
        const onChange = vi.fn();
        render(withContext(<TaskNodeView data={data({ onChange, task: { status: "Open" } })} />));
        fireEvent.click(screen.getByRole("button", { name: /Open/ }));
        const items = screen.getAllByRole("menuitem");
        expect(items.length).toBe(STATUS_NAMES.length);
        const wip = items.find((el) => within(el).queryByText("WIP"));
        expect(wip).toBeTruthy();
        expect(marks(wip as HTMLElement)).toEqual([reference("WIP")]);
        fireEvent.click(wip as HTMLElement);
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: "WIP" }));
    });

    it("picking the status the task already has changes nothing", () => {
        const onChange = vi.fn();
        render(withContext(<TaskNodeView data={data({ onChange, task: { status: "Open" } })} />));
        fireEvent.click(screen.getByRole("button", { name: /Open/ }));
        const open = screen.getAllByRole("menuitem").find((el) => within(el).queryByText("Open"));
        fireEvent.click(open as HTMLElement);
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe("priority on the graph nodes is the shared icon", () => {
    it.each(PRIORITY_NAMES)("%s: the icon in its tone, with its name, no chip", (p) => {
        const { container } = render(
            withContext(<TaskNodeView data={data({ task: { priority: p } })} />)
        );
        const icon = screen.getByRole("img", { name: p });
        expect(icon.style.color).toBe(toneCss(priorityTone(p)).text);
        expect(container.textContent).not.toContain(p);
        expect(container.querySelector(".MuiChip-root")).toBeNull();
    });

    it("an unset or unknown priority draws nothing", () => {
        for (const p of [null, "", "Medium"]) {
            const { unmount } = render(
                withContext(<TaskNodeView data={data({ task: { priority: p } })} />)
            );
            expect(screen.queryByTestId(/^PriorityBars/)).toBeNull();
            unmount();
        }
    });

    it("a ghost shows the External label instead of a priority; a dimmed card keeps it", () => {
        const ghost = render(
            withContext(
                <TaskNodeView data={data({ isExternal: true, task: { priority: "High" } })} />
            )
        );
        expect(ghost.getByText("External")).toBeTruthy();
        expect(ghost.queryByRole("img", { name: "High" })).toBeNull();
        ghost.unmount();
        const dimmed = render(
            withContext(
                <TaskNodeView data={data({ isDimmed: true, task: { priority: "High" } })} />
            )
        );
        expect(dimmed.queryByText("External")).toBeNull();
        expect(dimmed.getByRole("img", { name: "High" })).toBeTruthy();
    });
});

describe("the frame's graph states, in the order they always had", () => {
    const emphasisOf = (over: Partial<TaskNodeData>) => {
        const { container, unmount } = render(withContext(<TaskNodeView data={data(over)} />));
        const frame = frameOf(container);
        const out = {
            emphasis: frame.getAttribute("data-emphasis"),
            ghost: frame.getAttribute("data-ghost"),
            stripe: frame.getAttribute("data-stripe"),
            prominent: frame.getAttribute("data-prominent"),
        };
        unmount();
        return out;
    };

    it("current preview beats a just-created card, which beats an assigned one", () => {
        expect(
            emphasisOf({ isCurrentPreview: true, isNewlyCreated: true, isAssignedToViewer: true })
                .emphasis
        ).toBe("current");
        expect(emphasisOf({ isNewlyCreated: true, isAssignedToViewer: true }).emphasis).toBe(
            "new"
        );
        expect(emphasisOf({ isAssignedToViewer: true }).emphasis).toBe("assigned");
        expect(emphasisOf({}).emphasis).toBeNull();
    });

    it("a ghost and a dimmed card are plain: no highlight, no stripe", () => {
        const overdue = { task: { dueDate: day(-3), startDate: day(-9) } } as const;
        for (const over of [{ isExternal: true }, { isDimmed: true }]) {
            const out = emphasisOf({
                ...over,
                ...overdue,
                isCurrentPreview: true,
                isNewlyCreated: true,
                isAssignedToViewer: true,
            });
            expect(out.ghost).toBe("true");
            expect(out.emphasis).toBeNull();
            expect(out.stripe).toBeNull();
        }
    });

    it("the stripe follows the schedule: overdue is danger, due soon is warning, otherwise none", () => {
        expect(emphasisOf({ task: { dueDate: day(-3) } }).stripe).toBe("danger");
        expect(emphasisOf({ task: { dueDate: day(2) } }).stripe).toBe("warning");
        expect(emphasisOf({ task: { dueDate: day(30) } }).stripe).toBeNull();
        expect(emphasisOf({ task: { dueDate: day(-3), status: "Closed" } }).stripe).toBeNull();
        expect(emphasisOf({ task: {} }).stripe).toBeNull();
    });

    it("the root is prominent; a milestone node is too, and highlights like a task", () => {
        expect(emphasisOf({ isRoot: true }).prominent).toBe("true");
        expect(emphasisOf({}).prominent).toBeNull();
        const { container } = render(
            withContext(
                <MilestoneNodeView data={data({ isMilestone: true, isCurrentPreview: true })} />
            )
        );
        const frame = frameOf(container);
        expect(frame.getAttribute("data-prominent")).toBe("true");
        expect(frame.getAttribute("data-emphasis")).toBe("current");
    });

    it("each state is a role color, not a literal: border, halo and fill come from tokens", () => {
        const css = (emphasis: "current" | "new" | "assigned") => {
            const { container, unmount } = render(
                withContext(<TaskCardFrame emphasis={emphasis}>x</TaskCardFrame>)
            );
            const out = cssOf(frameOf(container));
            unmount();
            return out;
        };
        const current = css("current");
        expect(current).toContain("var(--g-accent)");
        expect(current).toContain("box-shadow: 0 0 0 3px var(--g-accent-border)");
        expect(current).toContain("var(--g-accent-subtle)");
        const added = css("new");
        expect(added).toContain("var(--g-info-solid)");
        expect(added).toContain("0 0 0 3px var(--g-info-border)");
        const assigned = css("assigned");
        expect(assigned).toContain("var(--g-warning-solid)");
        expect(assigned).toContain("0 0 0 3px var(--g-warning-border)");
        for (const c of [current, added, assigned])
            expect(c).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    });

    it("a ghost is dashed and dimmed; the frame ignores a highlight and a stripe on it", () => {
        const { container } = render(
            withContext(
                <TaskCardFrame emphasis="current" stripe="danger" ghost>
                    x
                </TaskCardFrame>
            )
        );
        const frame = frameOf(container);
        expect(frame.getAttribute("data-emphasis")).toBeNull();
        expect(frame.getAttribute("data-stripe")).toBeNull();
        const css = cssOf(frame);
        expect(css).toContain("dashed");
        expect(css).toContain("opacity: 0.92");
    });

    it("a node is not a control: default cursor, no pressed fill; it is as wide as the layout assumes", () => {
        const { container } = render(withContext(<TaskNodeView data={data()} />));
        const css = cssOf(frameOf(container));
        expect(css).toContain("cursor: default");
        expect(css).not.toContain(":active");
        expect(css).toContain(`width: ${NODE_WIDTH}px`);
        expect(frameOf(container).getAttribute("role")).toBeNull();
    });

    it("the leading-edge stripe is logical (it mirrors in Arabic) and a role color", () => {
        const { container } = render(
            withContext(<TaskCardFrame stripe="danger">x</TaskCardFrame>)
        );
        const css = cssOf(frameOf(container));
        expect(css).toContain("inset-inline-start: 0");
        expect(css).toContain("var(--g-danger-solid)");
    });
});

describe("a task node keeps what it did", () => {
    it("double-click renames inline: Enter commits, Escape cancels, blur commits", () => {
        const onChange = vi.fn();
        const { container } = render(withContext(<TaskNodeView data={data({ onChange })} />));
        const rename = () => {
            fireEvent.doubleClick(screen.getByTestId("task-title"));
            return container.querySelector("input") as HTMLInputElement;
        };
        let input = rename();
        expect(input.value).toBe("Node title");
        fireEvent.change(input, { target: { value: "New title" } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onChange).toHaveBeenCalledWith({ title: "New title" });
        expect(container.querySelector("input")).toBeNull();

        onChange.mockClear();
        input = rename();
        fireEvent.change(input, { target: { value: "Dropped" } });
        fireEvent.keyDown(input, { key: "Escape" });
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByText("Node title")).toBeTruthy();

        input = rename();
        fireEvent.change(input, { target: { value: "Blurred in" } });
        fireEvent.blur(input);
        expect(onChange).toHaveBeenCalledWith({ title: "Blurred in" });
    });

    it("an empty or unchanged title is not sent", () => {
        const onChange = vi.fn();
        const { container } = render(withContext(<TaskNodeView data={data({ onChange })} />));
        fireEvent.doubleClick(screen.getByTestId("task-title"));
        const input = container.querySelector("input") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "   " } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onChange).not.toHaveBeenCalled();
    });

    it("the dates open an editor; Save sends both (a blank one as null), Cancel sends nothing", () => {
        const onChange = vi.fn();
        render(
            withContext(
                <TaskNodeView
                    data={data({
                        onChange,
                        task: { startDate: "2026-01-02", dueDate: "2026-01-09" },
                    })}
                />
            )
        );
        fireEvent.click(screen.getByTestId("node-dates"));
        const dateInputs = document.querySelectorAll('input[type="date"]');
        expect(dateInputs.length).toBe(2);
        expect((dateInputs[0] as HTMLInputElement).value).toBe("2026-01-02");
        fireEvent.change(dateInputs[1], { target: { value: "" } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(onChange).toHaveBeenCalledWith({ startDate: "2026-01-02", dueDate: null });
        expect(document.querySelector('input[type="date"]')).toBeNull();

        onChange.mockClear();
        fireEvent.click(screen.getByTestId("node-dates"));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onChange).not.toHaveBeenCalled();
        expect(document.querySelector('input[type="date"]')).toBeNull();
    });

    it("the editor starts from the task's dates each time it opens", () => {
        const { rerender } = render(
            withContext(<TaskNodeView data={data({ task: { startDate: "2026-02-01" } })} />)
        );
        fireEvent.click(screen.getByTestId("node-dates"));
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        rerender(withContext(<TaskNodeView data={data({ task: { startDate: "2026-03-01" } })} />));
        fireEvent.click(screen.getByTestId("node-dates"));
        expect((document.querySelector('input[type="date"]') as HTMLInputElement).value).toBe(
            "2026-03-01"
        );
    });

    it("the open and add buttons call the canvas", () => {
        const onOpenPreview = vi.fn();
        const onAddSubtask = vi.fn();
        const { container } = render(
            withContext(<TaskNodeView data={data({ onOpenPreview, onAddSubtask })} />)
        );
        const buttons = [...container.querySelectorAll("button")].filter(
            (b) => b.getAttribute("aria-haspopup") !== "menu"
        );
        expect(buttons.length).toBe(2);
        fireEvent.click(buttons[0]);
        expect(onOpenPreview).toHaveBeenCalledTimes(1);
        fireEvent.click(buttons[1]);
        expect(onAddSubtask).toHaveBeenCalledTimes(1);
        // Neither opens the task through the card itself.
        expect(onOpenPreview).toHaveBeenCalledTimes(1);
    });

    it("a ghost is read-only: clicking it opens the preview; no menu, no add, dates are not editable", () => {
        const onOpenPreview = vi.fn();
        const onChange = vi.fn();
        const { container } = render(
            withContext(
                <TaskNodeView
                    data={data({
                        isExternal: true,
                        onChange,
                        onOpenPreview,
                        task: { dueDate: day(5) },
                    })}
                />
            )
        );
        expect(container.querySelectorAll("button").length).toBe(0);
        // Any click on a ghost bubbles to the card and opens the preview.
        fireEvent.click(screen.getByTestId("node-dates"));
        expect(document.querySelector('input[type="date"]')).toBeNull();
        expect(onOpenPreview).toHaveBeenCalledTimes(1);
        fireEvent.doubleClick(screen.getByTestId("task-title"));
        expect(container.querySelector("input")).toBeNull();
        fireEvent.click(frameOf(container));
        expect(onOpenPreview).toHaveBeenCalledTimes(2);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("an internal node is not opened by clicking its surface", () => {
        const onOpenPreview = vi.fn();
        const { container } = render(withContext(<TaskNodeView data={data({ onOpenPreview })} />));
        fireEvent.click(frameOf(container));
        expect(onOpenPreview).not.toHaveBeenCalled();
    });

    it("open blockers show a count with the plural tooltip wording; none shows nothing; a ghost hides it", () => {
        const one = render(withContext(<TaskNodeView data={data({ openBlockerCount: 1 })} />));
        expect(within(one.container).getByTestId("node-blockers").textContent).toBe("1");
        one.unmount();
        const none = render(withContext(<TaskNodeView data={data({ openBlockerCount: 0 })} />));
        expect(none.queryByTestId("node-blockers")).toBeNull();
        none.unmount();
        const ghost = render(
            withContext(<TaskNodeView data={data({ openBlockerCount: 3, isExternal: true })} />)
        );
        expect(ghost.queryByTestId("node-blockers")).toBeNull();
    });

    it("the due words and the duration are plain text in the family's due tones", () => {
        const { container } = render(
            withContext(
                <TaskNodeView data={data({ task: { startDate: day(-12), dueDate: day(-3) } })} />
            )
        );
        expect(screen.getByText("Overdue 3d")).toBeTruthy();
        expect(screen.getByTestId("node-duration").textContent).toBe("10d");
        const due = container.querySelector('[data-tone="overdue"]');
        expect(due).toBeTruthy();
        expect(container.querySelector(".MuiChip-root")).toBeNull();
    });

    it("the id is the family's quiet id (copy on click), and the title falls back to Untitled", () => {
        render(withContext(<TaskNodeView data={data({ task: { title: "" } })} />));
        expect(screen.getByText("MIP-7")).toBeTruthy();
        expect(screen.getByText("Untitled")).toBeTruthy();
    });
});

describe("a milestone node keeps what it did", () => {
    const ms = (over: Partial<TaskNodeData> = {}) =>
        data({
            isMilestone: true,
            closedDescendantCount: 3,
            totalDescendantCount: 12,
            sprint: { name: "Sprint 8", startDate: day(-12), endDate: day(2) } as never,
            task: { isMilestone: true, title: "Rollout", startDate: day(-12), dueDate: day(2) },
            ...over,
        });

    it("shows the flag, the progress count, the sprint, the pace verdict and the Milestone label", () => {
        const { container } = render(withContext(<MilestoneNodeView data={ms()} />));
        expect(container.querySelector('[data-testid="MilestoneFlag"]')).toBeTruthy();
        expect(screen.getByText("3/12")).toBeTruthy();
        expect(screen.getByText("Sprint 8")).toBeTruthy();
        expect(screen.getByText("Milestone")).toBeTruthy();
        const health = screen.getByTestId("node-health");
        expect(health.getAttribute("data-health")).toBe("behind");
        expect(screen.getByTestId("node-expected-marker").getAttribute("data-health")).toBe(
            "behind"
        );
        expect(container.querySelector(".MuiChip-root")).toBeNull();
    });

    it("the verdict dot is a role color", () => {
        render(withContext(<MilestoneNodeView data={ms()} />));
        const dot = screen.getByTestId("node-health").querySelector("span") as HTMLElement;
        expect(cssOf(dot)).toContain("var(--g-danger-solid)");
    });

    it("no descendants: no progress bar and no verdict", () => {
        render(
            withContext(
                <MilestoneNodeView
                    data={ms({ totalDescendantCount: 0, closedDescendantCount: 0 })}
                />
            )
        );
        expect(screen.queryByTestId("node-health")).toBeNull();
        expect(screen.queryByTestId("node-expected-marker")).toBeNull();
    });

    it("the open and add buttons call the canvas; an untitled milestone says so", () => {
        const onOpenPreview = vi.fn();
        const onAddSubtask = vi.fn();
        const { container } = render(
            withContext(
                <MilestoneNodeView
                    data={ms({
                        onOpenPreview,
                        onAddSubtask,
                        task: { title: "", isMilestone: true } as never,
                    })}
                />
            )
        );
        const [open, add] = [...container.querySelectorAll("button")];
        fireEvent.click(open);
        fireEvent.click(add);
        expect(onOpenPreview).toHaveBeenCalledTimes(1);
        expect(onAddSubtask).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Untitled milestone")).toBeTruthy();
    });
});

describe("the handles the canvas depends on", () => {
    const handles = (container: HTMLElement) =>
        Object.fromEntries(
            [...container.querySelectorAll("[data-handle]")].map((el) => [
                el.getAttribute("data-handle"),
                {
                    type: el.getAttribute("data-type"),
                    connectable: el.getAttribute("data-connectable"),
                    style: JSON.parse(el.getAttribute("data-style") ?? "{}"),
                },
            ])
        );
    const nodeProps = (d: TaskNodeData) => ({ data: d }) as never;

    it("a task node has the four handles; a ghost's are inert and dimmed", () => {
        const live = handles(
            render(withContext(<TaskNodeCard {...nodeProps(data())} />)).container
        );
        expect(Object.keys(live).sort()).toEqual(Object.values(HANDLE).sort());
        for (const h of Object.values(live)) expect(h.connectable).toBe("true");
        expect(live[HANDLE.structureTop].type).toBe("target");
        expect(live[HANDLE.structureBottom].type).toBe("source");
        expect(live[HANDLE.dependencyLeft].type).toBe("target");
        expect(live[HANDLE.dependencyRight].type).toBe("source");
    });

    it("a ghost's handles are inert and dimmed", () => {
        const { container } = render(
            withContext(<TaskNodeCard {...nodeProps(data({ isExternal: true }))} />)
        );
        for (const h of Object.values(handles(container))) {
            expect(h.connectable).toBe("false");
            expect(h.style.opacity).toBe(0.35);
        }
    });

    it("a milestone's structure handles are inert and its dependency handles live", () => {
        const { container } = render(
            withContext(<MilestoneNodeCard {...nodeProps(data({ isMilestone: true }))} />)
        );
        const h = handles(container);
        expect(h[HANDLE.structureTop].connectable).toBe("false");
        expect(h[HANDLE.structureBottom].connectable).toBe("false");
        expect(h[HANDLE.dependencyLeft].connectable).toBe("true");
        expect(h[HANDLE.dependencyRight].connectable).toBe("true");
    });

    it("the dependency handles are the dependency edge's orange, the structure handles the accent", () => {
        const { container } = render(withContext(<TaskNodeCard {...nodeProps(data())} />));
        const h = handles(container);
        expect(h[HANDLE.dependencyLeft].style.background).toBe(DEPENDENCY_COLOR);
        expect(h[HANDLE.dependencyRight].style.background).toBe(DEPENDENCY_COLOR);
        expect(h[HANDLE.structureTop].style.background).toBe("var(--g-accent)");
        expect(code("features/tasks/diagram/components/DependencyEdge.tsx")).toContain(
            "active ? DEPENDENCY_COLOR_ACTIVE : DEPENDENCY_COLOR"
        );
    });

    it("the node components stay memoized under their exported names", () => {
        for (const C of [TaskNodeCard, MilestoneNodeCard]) {
            expect((C as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for("react.memo"));
        }
    });
});

describe("the nodes carry no old chip, literal color or color-scheme subscription", () => {
    it.each([
        "features/tasks/diagram/components/TaskNodeCard.tsx",
        "features/tasks/diagram/components/MilestoneNodeCard.tsx",
    ])("%s", (file) => {
        const text = code(file);
        expect(text).not.toMatch(
            /#[0-9a-fA-F]{3,8}\b|rgba?\(|isDark|useColorScheme|--gp-|gradient|purplePalette|alpha\(|\bChip\b|statusSolid|prioritySolid|CopyableTaskIdChip|fontWeight:\s*[7-9]00/
        );
    });

    it("nodeParts: tokens only, and the one color-scheme hook is the date editor's", () => {
        const text = code("features/tasks/diagram/components/nodeParts.tsx");
        expect(text).not.toMatch(
            /#[0-9a-fA-F]{3,8}\b|rgba?\(|--gp-|gradient|purplePalette|alpha\(|\bChip\b|fontWeight:\s*[7-9]00/
        );
        expect(text.match(/useColorScheme\(\)/g)?.length).toBe(1);
        expect(text.indexOf("useColorScheme()")).toBeGreaterThan(
            text.indexOf("export const NodeDateEditor")
        );
    });
});

describe("the Sprint Insights milestone strip", () => {
    const milestone = (over: Partial<Milestone> = {}): Milestone =>
        ({
            milestoneId: 7,
            taskId: 70,
            displayId: "MIP-70",
            projectId: 1,
            teamId: 1,
            sprintId: 3,
            title: "Strip milestone",
            status: "WIP",
            priority: null,
            tags: [],
            assignees: [],
            tasksTotal: 4,
            tasksClosed: 1,
            ...over,
        }) as unknown as Milestone;

    const strip = (ms: Milestone[], useTM: Record<string, unknown> = {}) =>
        render(
            withContext(
                <SprintMilestonesSection
                    myself={{ userId: "me" } as UserProps}
                    projectId={1}
                    selectedSprint={{ sprintId: 3, name: "Sprint 3" } as never}
                    setMyself={NOOP}
                    socket={null}
                    useCM={{} as never}
                    useSM={{ projectMilestones: { 1: ms } } as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useTM={useTM as never}
                    useUISM={{} as never}
                />
            )
        );

    it.each(STATUS_NAMES)("%s: the table's icon and color, no chip, no loose dot", (s) => {
        const expected = reference(s);
        const { container } = strip([milestone({ status: s })]);
        expect(marks(container)).toEqual([expected]);
        expect(container.querySelector(".MuiChip-root")).toBeNull();
    });

    it("a row is a family card: flag, quiet id, title, count; click and Enter open the milestone", () => {
        const setCurrentPreviewKind = vi.fn();
        const setCurrentPreviewMilestoneId = vi.fn();
        const setIsTaskPreviewVisible = vi.fn();
        const { container } = strip([milestone()], {
            setCurrentPreviewKind,
            setCurrentPreviewMilestoneId,
            setIsTaskPreviewVisible,
        });
        expect(container.querySelector('[data-testid="MilestoneFlag"]')).toBeTruthy();
        expect(screen.getByText("MIP-70")).toBeTruthy();
        expect(screen.getByText("1/4")).toBeTruthy();
        const card = screen.getByRole("button", { name: "Strip milestone" });
        fireEvent.click(card);
        fireEvent.keyDown(card, { key: "Enter" });
        expect(setCurrentPreviewKind).toHaveBeenCalledWith("milestone");
        expect(setCurrentPreviewMilestoneId).toHaveBeenCalledWith(7);
        expect(setIsTaskPreviewVisible).toHaveBeenCalledTimes(2);
    });

    it("only this sprint's milestones are listed, and an empty sprint says so", () => {
        const some = strip([
            milestone(),
            milestone({ milestoneId: 8, sprintId: 9, title: "Other sprint" }),
        ]);
        expect(screen.queryByText("Other sprint")).toBeNull();
        expect(screen.getByTestId("sprint-milestones-count").textContent).toBe("1");
        some.unmount();
        strip([]);
        expect(screen.getByText("No milestones in this sprint yet.")).toBeTruthy();
    });

    it("has no old chip, literal color, STATUS_FILL or isDark", () => {
        const text = code(
            "features/tasks/sprint-milestone/components/SprintMilestonesSection.tsx"
        );
        expect(text).not.toMatch(
            /#[0-9a-fA-F]{3,8}\b|rgba?\(|isDark|--gp-|\bChip\b|STATUS_FILL|\bCard\b/
        );
    });
});

describe("the preview header's id", () => {
    const withTask = (task: { displayId?: string | null; id?: number | string | null }) =>
        render(withContext(<PreviewTaskIdChip task={task} />));

    it("shows a milestone's display id, then the backing task id, then N/A", () => {
        const a = withTask({ displayId: "MIP-123", id: 99 });
        expect(a.getByText("MIP-123")).toBeTruthy();
        a.unmount();
        const b = withTask({ displayId: null, id: 99 });
        expect(b.getByText("#99")).toBeTruthy();
        b.unmount();
        const c = withTask({ displayId: null, id: null });
        expect(c.getByText("N/A")).toBeTruthy();
    });

    it("is the family's quiet id, not a Joy chip", () => {
        const { container } = withTask({ displayId: "MIP-123", id: 99 });
        expect(container.querySelector(".MuiChip-root")).toBeNull();
        expect(cssOf(screen.getByText("MIP-123"))).toContain("var(--g-text-tertiary)");
        expect(code("features/tasks/components/PreviewTaskIdChip.tsx")).not.toMatch(
            /\bChip\b|rgba?\(|isDark/
        );
    });

    it("copies the id on click, and from the keyboard (it is a button you can Tab to)", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });
        withTask({ displayId: "MIP-123", id: 99 });
        const id = screen.getByRole("button", { name: /MIP-123/ });
        expect(id.getAttribute("tabindex")).toBe("0");
        await act(async () => {
            fireEvent.click(id);
        });
        expect(writeText).toHaveBeenCalledWith("MIP-123");
        writeText.mockClear();
        await act(async () => {
            fireEvent.keyDown(id, { key: "Enter" });
        });
        expect(writeText).toHaveBeenCalledWith("MIP-123");
        writeText.mockClear();
        await act(async () => {
            fireEvent.keyDown(id, { key: "a" });
        });
        expect(writeText).not.toHaveBeenCalled();
    });
});

describe("bugs found by looking at the graph in a browser", () => {
    it("Escape cancels an inline rename and does not close the graph dialog", () => {
        const onClose = vi.fn();
        const { container } = render(
            withContext(
                <div onKeyDown={(e) => e.key === "Escape" && onClose()}>
                    <TaskNodeView data={data()} />
                </div>
            )
        );
        fireEvent.doubleClick(screen.getByTestId("task-title"));
        const input = container.querySelector("input") as HTMLInputElement;
        fireEvent.keyDown(input, { key: "Escape" });
        expect(container.querySelector("input")).toBeNull();
        expect(onClose).not.toHaveBeenCalled();
    });

    it("Escape closes the status menu and does not close the graph dialog", () => {
        const onClose = vi.fn();
        render(
            withContext(
                <div onKeyDown={(e) => e.key === "Escape" && onClose()}>
                    <TaskNodeView data={data()} />
                </div>
            )
        );
        fireEvent.click(screen.getByRole("button", { name: /Open/ }));
        const items = screen.getAllByRole("menuitem");
        fireEvent.keyDown(items[0], { key: "Escape" });
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.queryAllByRole("menuitem").length).toBe(0);
    });

    it("the clock of a due date takes the date's color (Joy icons read --Icon-color, not color)", () => {
        const { container } = render(
            withContext(<TaskNodeView data={data({ task: { dueDate: day(-3) } })} />)
        );
        const due = container.querySelector('[data-tone="overdue"]') as HTMLElement;
        const css = cssOf(due);
        expect(css).toContain("--Icon-color: var(--g-danger-text)");
        expect(css).toContain("color: var(--g-danger-text)");
    });
});

describe("the task preview's other id chips are the family's quiet id", () => {
    it.each([
        [
            "Blocked by / Blocks rows",
            "features/tasks/components/contents/base/TaskDependenciesBlock.tsx",
        ],
        ["sub-task rows", "features/tasks/components/contents/base/TaskSubTasksBlock.tsx"],
        ["the parent row", "features/tasks/components/contents/base/TaskMainBlock.tsx"],
    ])("%s", (_name, file) => {
        const text = code(file);
        expect(text).toContain("<TaskIdText");
        expect(text).not.toContain("CopyableTaskIdChip");
        // No Joy chip is left around an id (the sub-task tags and the branch
        // links are other chips, and stay).
        expect(text).not.toMatch(/<Chip[^>]*>\s*\{(ref_\.displayId|formatTaskDisplayId)/);
    });
});
