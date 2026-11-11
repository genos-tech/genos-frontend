/**
 * MIP-1353. "Manage dependencies" asked the server for EVERY task of the picked project, closed
 * ones included, to filter them in the browser, even for the project that is open and whose rows
 * the task table already holds. For that project the picker now uses the rows it is given
 * (`knownTasks`) and sends nothing; any other project is fetched as before.
 *
 * The loader is faked to count requests; the autocomplete is the real one, opened with a click, so
 * what is asserted is what a user would be offered.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTaskSelector } from "../features/tasks/components/autocompletes/ACTaskSelector";
import { loadProjectTasksFromApi } from "../features/tasks/services/loadProjectTasksFromApi";
import type { ProjectManagementState } from "../hooks/common/useProjectManagement";
import type { ProjectProps, TaskTableProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/services/loadProjectTasksFromApi", () => ({
    loadProjectTasksFromApi: vi.fn(),
}));
const mockLoad = vi.mocked(loadProjectTasksFromApi);

const project = (projectId: number, projectName: string) =>
    ({ projectId, projectName, projectTags: [] }) as unknown as ProjectProps;
const ALPHA = project(1, "Alpha");
const BETA = project(2, "Beta");

const row = (fields: Record<string, unknown>) =>
    ({ projectId: 1, ...fields }) as unknown as TaskTableProps;
const ROWS = [
    row({ id: "1", title: "Live task", status: "Open" }),
    row({ id: "2", title: "Closed parent", status: "Closed" }),
    row({ id: "3", title: "Under the closed parent", status: "Open", parentTaskId: "2" }),
    row({ id: "4", title: "Another live task", status: "WIP" }),
];

const usePM = { teamProjects: [ALPHA, BETA] } as unknown as ProjectManagementState;

const mount = (props: Partial<React.ComponentProps<typeof ACTaskSelector>> = {}) =>
    render(
        <CssVarsProvider>
            <ACTaskSelector
                defaultProjectId={1}
                excludeTaskIds={new Set()}
                myself={{ teamId: "t" } as never}
                usePM={usePM}
                onPick={vi.fn()}
                {...props}
            />
        </CssVarsProvider>
    );

/** The titles the task autocomplete offers, after opening it. */
const offered = async () => {
    const taskInput = screen.getAllByRole("combobox").at(-1) as HTMLElement;
    fireEvent.click(taskInput);
    fireEvent.keyDown(taskInput, { key: "ArrowDown" });
    await waitFor(() => expect(screen.queryAllByRole("option").length).toBeGreaterThan(0));
    return screen.getAllByRole("option").map((o) => o.textContent ?? "");
};
const has = (titles: string[], text: string) => titles.some((t) => t.includes(text));

beforeEach(() => {
    mockLoad.mockReset();
    mockLoad.mockResolvedValue({ tasks: ROWS } as never);
});

describe("ACTaskSelector with the host's rows (MIP-1353)", () => {
    it("sends no request for the open project, and offers its live tasks", async () => {
        mount({ knownTasks: { projectId: 1, tasks: ROWS } });
        const titles = await offered();

        expect(mockLoad).not.toHaveBeenCalled();
        expect(has(titles, "Live task")).toBe(true);
        expect(has(titles, "Another live task")).toBe(true);
    });

    it("still hides Closed, and what is under a Closed task (the host's rows are the whole list)", async () => {
        mount({ knownTasks: { projectId: 1, tasks: ROWS } });
        const titles = await offered();

        expect(has(titles, "Closed parent")).toBe(false);
        expect(has(titles, "Under the closed parent")).toBe(false);
    });

    it("without host rows it asks, exactly as before", async () => {
        mount();
        await offered();
        expect(mockLoad).toHaveBeenCalledTimes(1);
        expect(mockLoad.mock.calls[0][1]).toBe(1);
    });

    it("host rows that are still empty (not loaded yet) fall through to a request", async () => {
        mount({ knownTasks: { projectId: 1, tasks: [] } });
        await offered();
        expect(mockLoad).toHaveBeenCalledTimes(1);
    });

    it("host rows are for ONE project: another project's picker is not served from them", async () => {
        mount({ defaultProjectId: 2, knownTasks: { projectId: 1, tasks: ROWS } });
        await offered();
        expect(mockLoad).toHaveBeenCalledTimes(1);
        expect(mockLoad.mock.calls[0][1]).toBe(2);
    });

    it("a row of another project (a list caught mid-switch) is never offered", async () => {
        const stray = row({
            id: "9",
            title: "From another project",
            status: "Open",
            projectId: 2,
        });
        mount({ knownTasks: { projectId: 1, tasks: [...ROWS, stray] } });
        const titles = await offered();

        expect(mockLoad).not.toHaveBeenCalled();
        expect(has(titles, "From another project")).toBe(false);
        expect(has(titles, "Live task")).toBe(true);
    });

    it("rows that arrive later are used without a request", async () => {
        const view = mount({ knownTasks: { projectId: 1, tasks: [] } });
        await waitFor(() => expect(mockLoad).toHaveBeenCalledTimes(1));
        view.rerender(
            <CssVarsProvider>
                <ACTaskSelector
                    defaultProjectId={1}
                    excludeTaskIds={new Set()}
                    knownTasks={{
                        projectId: 1,
                        tasks: [...ROWS, row({ id: "5", title: "Brand new", status: "Open" })],
                    }}
                    myself={{ teamId: "t" } as never}
                    usePM={usePM}
                    onPick={vi.fn()}
                />
            </CssVarsProvider>
        );
        const titles = await offered();
        expect(has(titles, "Brand new")).toBe(true);
        expect(mockLoad).toHaveBeenCalledTimes(1);
    });

    it("switching from a project still loading to the open one clears the spinner", async () => {
        // Beta's request never answers; switching to Alpha cancels it, and with it its own
        // `setLoading(false)`: Alpha needs no request, so nothing else would clear the spinner.
        mockLoad.mockReturnValue(new Promise(() => {}) as never);
        mount({ defaultProjectId: 2, knownTasks: { projectId: 1, tasks: ROWS } });
        const spinner = () => screen.queryByRole("progressbar", { name: /Loading/ });
        await waitFor(() => expect(spinner()).not.toBeNull());

        const projectInput = screen.getAllByRole("combobox")[0];
        fireEvent.click(projectInput);
        fireEvent.keyDown(projectInput, { key: "ArrowDown" });
        const alpha = await screen.findByRole("option", { name: /Alpha/ });
        fireEvent.click(alpha);

        await waitFor(() => expect(spinner()).toBeNull());
    });

    it("excluded ids are still dropped from the host's rows", async () => {
        mount({ knownTasks: { projectId: 1, tasks: ROWS }, excludeTaskIds: new Set([1]) });
        const titles = await offered();
        expect(has(titles, "Live task")).toBe(false);
        expect(has(titles, "Another live task")).toBe(true);
    });
});
