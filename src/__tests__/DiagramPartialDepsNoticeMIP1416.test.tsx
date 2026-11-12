/**
 * MIP-1416: when some dependency lines could not be loaded, the diagram still
 * draws, and says the lines may be missing, instead of showing those cards as
 * unconnected. (The loader used to fall back to one request per task, which on a
 * rate limit made hundreds more requests against the same limit.)
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFlowCanvas } from "../features/tasks/diagram/components/TaskFlowCanvas";
import { tasks as en } from "../i18n/locales/en/tasks";

const loadTaskGraph = vi.fn();
vi.mock("../features/tasks/diagram/services/loadTaskGraph", () => ({
    loadTaskGraph: (...args: unknown[]) => loadTaskGraph(...args),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

vi.stubGlobal(
    "ResizeObserver",
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
);

const root = {
    id: "5",
    title: "Root",
    status: "Open",
    parentTaskId: null,
    projectId: 1,
    isMilestone: true,
    tags: [],
};

const graph = (dependenciesIncomplete: boolean) => ({
    rootTaskId: 5,
    tasks: [root],
    externalTasks: [],
    dependencyEdges: [],
    dependenciesIncomplete,
});

const renderCanvas = () =>
    render(
        <CssVarsProvider>
            <div style={{ width: 800, height: 600 }}>
                <TaskFlowCanvas
                    hideClosed={false}
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    projectId={1}
                    rootTaskId={5}
                    usePM={{} as never}
                    useTM={{ currentPreviewTaskId: -1 } as never}
                    onCloseModal={vi.fn()}
                />
            </div>
        </CssVarsProvider>
    );

describe("TaskFlowCanvas partial dependencies notice", () => {
    beforeEach(() => {
        loadTaskGraph.mockReset();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("says some lines could not be loaded when the graph is incomplete", async () => {
        loadTaskGraph.mockResolvedValue(graph(true));
        renderCanvas();
        expect(await screen.findByText(en.diagram.errors.dependenciesPartial)).toBeTruthy();
    });

    it("says nothing when every line loaded", async () => {
        loadTaskGraph.mockResolvedValue(graph(false));
        renderCanvas();
        await waitFor(() => expect(loadTaskGraph).toHaveBeenCalled());
        await new Promise((r) => setTimeout(r, 50));
        expect(screen.queryByText(en.diagram.errors.dependenciesPartial)).toBeNull();
    });
});
