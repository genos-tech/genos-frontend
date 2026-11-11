/**
 * MIP-1320: Backspace/Delete in the graph must not remove a card.
 *
 * React Flow has one `deleteKeyCode` for nodes and edges. `onNodesChange` only applies the
 * removal locally, so a selected card vanished from the canvas while the task stayed on the
 * server. Deleting a task is the card's own confirmed soft delete (MIP-1302); the key may
 * only remove an edge the user selected, which goes to the server (dependency / re-parent).
 * Deleting a node must also never unlink its neighbours (React Flow adds the edges that
 * touch a removed node).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFlowCanvas } from "../features/tasks/diagram/components/TaskFlowCanvas";
import type { TaskTableProps } from "../types/tasks";

const loadTaskGraph = vi.fn();
const patchTaskFields = vi.fn();
const deleteTaskDependency = vi.fn();
vi.mock("../features/tasks/diagram/services/loadTaskGraph", () => ({
    loadTaskGraph: (...args: unknown[]) => loadTaskGraph(...args),
}));
vi.mock("../features/tasks/diagram/services/patchTaskFields", () => ({
    patchTaskFields: (...args: unknown[]) => patchTaskFields(...args),
}));
vi.mock("../features/tasks/services/deleteTaskDependency", () => ({
    deleteTaskDependency: (...args: unknown[]) => deleteTaskDependency(...args),
}));
vi.mock("../features/tasks/services/addTask", () => ({ addTask: vi.fn() }));
vi.mock("../db/services/task-full.service", () => ({ invalidateCachedFullTask: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/diagram/components/TaskNodeCard", () => ({
    TaskNodeCard: ({ data }: { data: { task: { id: string } } }) => (
        <div data-testid={`card-${data.task.id}`}>card</div>
    ),
}));
vi.mock("../features/tasks/diagram/components/MilestoneNodeCard", () => ({
    MilestoneNodeCard: () => null,
}));

// jsdom measures no handles, so React Flow draws no edges here: keep a handle on the props
// it receives to reach the edge side of the contract.
let flowProps: Record<string, any> = {};
vi.mock("@xyflow/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@xyflow/react")>();
    return {
        ...actual,
        ReactFlow: (props: Record<string, unknown>) => {
            flowProps = props;
            return <actual.ReactFlow {...(props as object)} />;
        },
    };
});

vi.stubGlobal(
    "ResizeObserver",
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
);

const row = (id: number, parentTaskId: number | null): TaskTableProps =>
    ({
        id: String(id),
        title: `task ${id}`,
        status: "Open",
        parentTaskId: parentTaskId == null ? null : String(parentTaskId),
        projectId: 1,
        tags: [],
    }) as unknown as TaskTableProps;

// 1 is the parent of 2; 3 is blocked by 2 (dependency 77).
const graph = () => ({
    rootTaskId: 1,
    tasks: [row(1, null), row(2, 1), row(3, 1)],
    externalTasks: [],
    dependencyEdges: [
        { dependencyId: 77, blockerTaskId: 2, blockedTaskId: 3, otherStatus: "Open" as const },
    ],
});

const renderCanvas = () =>
    render(
        <CssVarsProvider>
            <div style={{ width: 800, height: 600 }}>
                <TaskFlowCanvas
                    hideClosed={false}
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    projectId={1}
                    rootTaskId={1}
                    usePM={{} as never}
                    useTM={
                        {
                            currentPreviewTaskId: -1,
                            setAllTasks: vi.fn(),
                            loadUpdatedTask: vi.fn().mockResolvedValue(undefined),
                        } as never
                    }
                    onCloseModal={vi.fn()}
                />
            </div>
        </CssVarsProvider>
    );

const node = (id: number) =>
    document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement;
// keydown and keyup in separate renders (React batches a same-tick pair into no press at
// all), then a beat for React Flow's async `deleteElements` to finish.
// The canvas handles the key itself (MIP-1390): the modal frame stops key events at its root,
// so nothing listens on the document.
const canvas = () => document.querySelector(".react-flow")!.parentElement as HTMLElement;
const pressDelete = async (key: "Delete" | "Backspace", target: HTMLElement = canvas()) => {
    await act(async () => {
        fireEvent.keyDown(target, { key, code: key });
        await new Promise((r) => setTimeout(r, 100));
    });
};
// Select edges the way a click does: through React Flow's change events.
const selectEdges = async (...ids: string[]) => {
    await waitFor(() =>
        expect(flowProps.edges.map((e: { id: string }) => e.id)).toContain("d-77")
    );
    act(() => {
        flowProps.onEdgesChange(ids.map((id) => ({ type: "select", id, selected: true })));
    });
    await waitFor(() =>
        expect(flowProps.edges.filter((e: { selected?: boolean }) => e.selected).length).toBe(
            ids.length
        )
    );
};

describe("graph delete key", () => {
    beforeEach(() => {
        loadTaskGraph.mockReset();
        loadTaskGraph.mockImplementation(async () => graph());
        patchTaskFields.mockReset();
        patchTaskFields.mockResolvedValue({ ok: true });
        deleteTaskDependency.mockReset();
        deleteTaskDependency.mockResolvedValue({ ok: true });
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it.each(["Delete", "Backspace"] as const)(
        "%s on a selected card keeps the card and changes nothing on the server",
        { timeout: 20000 },
        async (key) => {
            renderCanvas();
            await screen.findByTestId("card-2");
            fireEvent.click(node(2));
            await waitFor(() => expect(node(2).className).toContain("selected"));

            await pressDelete(key);

            expect(screen.getByTestId("card-2")).toBeTruthy();
            expect(patchTaskFields).not.toHaveBeenCalled();
            // The dependency 2 -> 3 touches the selected card: it must survive too.
            expect(deleteTaskDependency).not.toHaveBeenCalled();
            expect(flowProps.edges.map((e: { id: string }) => e.id)).toContain("d-77");
        }
    );

    it("only a selected edge survives the pre-delete filter (not the ones touching a card)", async () => {
        renderCanvas();
        await screen.findByTestId("card-2");
        const doomed = await flowProps.onBeforeDelete({
            nodes: [{ id: "2" }],
            edges: [
                { id: "d-77", selected: false },
                { id: "s-1-2", selected: false },
                { id: "s-1-3", selected: true },
            ],
        });
        expect(doomed.nodes).toEqual([]);
        expect(doomed.edges.map((e: { id: string }) => e.id)).toEqual(["s-1-3"]);
    });

    it("a removed edge still reaches the server (dependency and re-parent)", async () => {
        renderCanvas();
        await screen.findByTestId("card-2");
        // Wait for the graph to be laid out so the edges exist in the props.
        await waitFor(() =>
            expect(flowProps.edges.map((e: { id: string }) => e.id)).toContain("d-77")
        );
        act(() => {
            flowProps.onEdgesChange([
                { type: "remove", id: "d-77" },
                { type: "remove", id: "s-1-3" },
            ]);
        });
        expect(deleteTaskDependency).toHaveBeenCalledWith(77, "tok");
        expect(patchTaskFields).toHaveBeenCalledWith(
            3,
            { parent_task_id: null, milestone: null },
            "tok"
        );
    });

    // MIP-1390: the modal frame stops key events at its root, so React Flow never saw the
    // key and a selected edge could not be deleted.
    describe("a selected edge", () => {
        it.each(["Delete", "Backspace"] as const)(
            "%s removes a dependency edge on the server",
            { timeout: 20000 },
            async (key) => {
                renderCanvas();
                await screen.findByTestId("card-2");
                await selectEdges("d-77");
                await pressDelete(key);
                expect(deleteTaskDependency).toHaveBeenCalledWith(77, "tok");
                expect(patchTaskFields).not.toHaveBeenCalled();
                expect(flowProps.edges.map((e: { id: string }) => e.id)).not.toContain("d-77");
            }
        );

        it("removes a parent-child edge by re-parenting the child to nothing", async () => {
            renderCanvas();
            await screen.findByTestId("card-2");
            await selectEdges("s-1-3");
            await pressDelete("Delete");
            expect(patchTaskFields).toHaveBeenCalledWith(
                3,
                { parent_task_id: null, milestone: null },
                "tok"
            );
            expect(deleteTaskDependency).not.toHaveBeenCalled();
        });

        it("only the selected edge goes, and the selected card with it never does", async () => {
            renderCanvas();
            await screen.findByTestId("card-2");
            fireEvent.click(node(2));
            await waitFor(() => expect(node(2).className).toContain("selected"));
            await selectEdges("d-77");
            await pressDelete("Delete");
            expect(deleteTaskDependency).toHaveBeenCalledTimes(1);
            expect(patchTaskFields).not.toHaveBeenCalled();
            expect(screen.getByTestId("card-2")).toBeTruthy();
            expect(flowProps.edges.map((e: { id: string }) => e.id)).toContain("s-1-2");
        });

        it("typing Backspace in a field of the canvas deletes nothing", async () => {
            renderCanvas();
            await screen.findByTestId("card-2");
            await selectEdges("d-77");
            const input = document.createElement("input");
            canvas().appendChild(input);
            await pressDelete("Backspace", input);
            expect(deleteTaskDependency).not.toHaveBeenCalled();
            input.remove();
        });

        it("with nothing selected the key does nothing", async () => {
            renderCanvas();
            await screen.findByTestId("card-2");
            await waitFor(() =>
                expect(flowProps.edges.map((e: { id: string }) => e.id)).toContain("d-77")
            );
            await pressDelete("Delete");
            expect(deleteTaskDependency).not.toHaveBeenCalled();
            expect(patchTaskFields).not.toHaveBeenCalled();
        });
    });
});
