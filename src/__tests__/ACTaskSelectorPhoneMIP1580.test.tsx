/**
 * MIP-1580. On a phone the Manage dependencies picker put Project and Task side by side, and the
 * Task field (whose dropdown is as wide as its input) came out 48px wide at 390px and 26px at
 * 360px: it could be tapped, but its options had nowhere to draw. The fields now stack below `md`
 * and the popup is capped to the screen; on a phone an option's title wraps under its id.
 *
 * jsdom has no layout engine and does not evaluate media queries from the viewport, so the stack
 * itself (`{ xs: column, md: row }`) is proved in a real browser (numbers in the PR), not here.
 * What this pins: the declarations that do not depend on a media query (the popup's cap), and
 * the phone/desktop split of the option row, driven by the same `useIsMobile` the app uses.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACTaskSelector } from "../features/tasks/components/autocompletes/ACTaskSelector";
import type { ProjectManagementState } from "../hooks/common/useProjectManagement";
import type { ProjectProps, TaskTableProps } from "../types/tasks";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/services/loadProjectTasksFromApi", () => ({
    loadProjectTasksFromApi: vi.fn(),
}));

const ALPHA = { projectId: 1, projectName: "Alpha", projectTags: [] } as unknown as ProjectProps;
const ROWS = [
    {
        id: "1",
        displayId: "GEN-1",
        projectId: 1,
        status: "Open",
        title: "A very long task title that cannot fit beside its id and status on a phone",
    },
] as unknown as TaskTableProps[];
const usePM = { teamProjects: [ALPHA] } as unknown as ProjectManagementState;

const setPhone = (isPhone: boolean) =>
    vi.stubGlobal(
        "matchMedia",
        vi.fn().mockImplementation((query: string) => ({
            matches: isPhone,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
        }))
    );

const openTaskList = async () => {
    render(
        <CssVarsProvider>
            <ACTaskSelector
                defaultProjectId={1}
                excludeTaskIds={new Set()}
                knownTasks={{ projectId: 1, tasks: ROWS }}
                myself={{ teamId: "t" } as never}
                usePM={usePM}
                onPick={vi.fn()}
            />
        </CssVarsProvider>
    );
    const taskInput = screen.getAllByRole("combobox").at(-1) as HTMLElement;
    fireEvent.click(taskInput);
    fireEvent.keyDown(taskInput, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
};

beforeEach(() => setPhone(false));
afterEach(() => vi.unstubAllGlobals());

describe("ACTaskSelector on a phone (MIP-1580)", () => {
    it("caps the dropdown to the screen, whatever the field above it measures", async () => {
        await openTaskList();
        const listbox = screen.getByRole("listbox");
        expect(getComputedStyle(listbox).maxWidth).toBe("calc(100vw - 16px)");
    });

    it("keeps the option title on one line beside its id on a desktop", async () => {
        await openTaskList();
        const title = screen.getByTestId("task-title");
        expect(getComputedStyle(title).whiteSpace).toBe("nowrap");
    });

    it("lets the option title wrap (two lines) on a phone", async () => {
        setPhone(true);
        await openTaskList();
        const title = screen.getByTestId("task-title");
        const style = getComputedStyle(title);
        expect(style.whiteSpace).not.toBe("nowrap");
        expect(style.webkitLineClamp ?? style.getPropertyValue("-webkit-line-clamp")).toBe("2");
    });
});
