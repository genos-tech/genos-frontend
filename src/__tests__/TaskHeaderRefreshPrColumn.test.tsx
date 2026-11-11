/**
 * MIP-1409. The "Refresh tasks" button in the task table header reloads the rows, and now also
 * tells the PR column to re-sync (a merge or a CI run had no other way to show up short of
 * re-opening the table).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    _resetPrResyncForTests,
    getPrResyncRequest,
    PR_RESYNC_MANUAL_COOLDOWN_MS,
    subscribePrResync,
} from "../features/integrations/services/prResync";
import { TaskHeader } from "../features/tasks/components/header/TaskHeader";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/tasks/components/sidebar/SearchBox", () => ({
    TaskSidebarSearchBox: () => <input aria-label="Search tasks" />,
}));

const mount = (currentProject: Record<string, unknown> | null) => {
    const refreshProjectTasks = vi.fn(async () => undefined);
    render(
        <MemoryRouter>
            <CssVarsProvider>
                <TaskHeader
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{ allChats: [] } as never}
                    usePM={{ currentProject, projects: [], refreshProjectTasks } as never}
                    useTEM={{ teamMembers: [] } as never}
                    useTM={{ isCreatingTask: { flag: false }, handleCreateTask: vi.fn() } as never}
                    useUISM={{} as never}
                    onCloseTaskHome={vi.fn()}
                    onCreateProject={vi.fn()}
                    onDeleteProject={vi.fn()}
                    onManageTags={vi.fn()}
                />
            </CssVarsProvider>
        </MemoryRouter>
    );
    return { refreshProjectTasks };
};
const PROJECT = { projectId: 7, projectName: "Apollo", isPrivate: false };
const refreshButton = () => screen.getByRole("button", { name: "Refresh Tasks" });

let seen: string[];
let unsubscribe: () => void;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    _resetPrResyncForTests();
    seen = [];
    // A PR cell on screen, as far as the signal can tell.
    unsubscribe = subscribePrResync(() => seen.push(getPrResyncRequest().reason));
});

afterEach(() => {
    unsubscribe();
    cleanup();
    _resetPrResyncForTests();
    vi.useRealTimers();
});

describe("the Refresh tasks button", () => {
    it("reloads the rows and tells the PR column to re-sync, as a click (every row, fresh)", () => {
        const { refreshProjectTasks } = mount(PROJECT);
        fireEvent.click(refreshButton());
        expect(refreshProjectTasks).toHaveBeenCalledWith(7);
        expect(seen).toEqual(["manual"]);
    });

    it("a second click within the cooldown still reloads the rows, but not the PR column again", () => {
        const { refreshProjectTasks } = mount(PROJECT);
        fireEvent.click(refreshButton());
        fireEvent.click(refreshButton());
        expect(refreshProjectTasks).toHaveBeenCalledTimes(2);
        expect(seen).toEqual(["manual"]);

        vi.advanceTimersByTime(PR_RESYNC_MANUAL_COOLDOWN_MS);
        fireEvent.click(refreshButton());
        expect(refreshProjectTasks).toHaveBeenCalledTimes(3);
        expect(seen).toEqual(["manual", "manual"]);
    });

    it("is not there without an open project, so nothing is requested", () => {
        mount(null);
        expect(screen.queryByRole("button", { name: "Refresh Tasks" })).toBeNull();
        expect(seen).toEqual([]);
    });
});
