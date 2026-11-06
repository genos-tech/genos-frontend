/**
 * The canvas asks the loader for the scope it was given (MIP-1094).
 *
 * The loader is stubbed (it answers "no graph", so nothing is drawn): what matters
 * here is the call, including that a canvas given no scope asks for the whole tree.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFlowCanvas } from "../features/tasks/diagram/components/TaskFlowCanvas";

const loadTaskGraph = vi.fn();
vi.mock("../features/tasks/diagram/services/loadTaskGraph", () => ({
    loadTaskGraph: (...args: unknown[]) => loadTaskGraph(...args),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

// jsdom has no ResizeObserver, which React Flow reads on mount.
vi.stubGlobal(
    "ResizeObserver",
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
);

const renderCanvas = (scope?: "tree" | "task") =>
    render(
        <CssVarsProvider>
            <div style={{ width: 800, height: 600 }}>
                <TaskFlowCanvas
                    hideClosed={false}
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    projectId={1}
                    rootTaskId={5}
                    scope={scope}
                    usePM={{} as never}
                    useTM={{ currentPreviewTaskId: -1 } as never}
                    onCloseModal={vi.fn()}
                />
            </div>
        </CssVarsProvider>
    );

describe("TaskFlowCanvas scope", () => {
    beforeEach(() => {
        loadTaskGraph.mockReset();
        loadTaskGraph.mockResolvedValue(null);
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("asks for the task scope when given it", async () => {
        renderCanvas("task");

        await waitFor(() => expect(loadTaskGraph).toHaveBeenCalled());
        const [, projectId, anchor, token, scope] = loadTaskGraph.mock.calls[0];
        expect([projectId, anchor, token, scope]).toEqual([1, 5, "tok", "task"]);
    });

    it("asks for the whole tree when given no scope", async () => {
        renderCanvas();

        await waitFor(() => expect(loadTaskGraph).toHaveBeenCalled());
        expect(loadTaskGraph.mock.calls[0][4]).toBe("tree");
    });
});
