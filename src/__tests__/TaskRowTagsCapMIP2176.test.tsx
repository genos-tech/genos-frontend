/**
 * A task with many tags used to push its title out of its row in "Sub tasks" and
 * "Tasks in this milestone" (MIP-2176). A row now shows at most 2 tag chips (1 on a
 * phone) plus a "+N" chip that names the hidden tags. The "+N" chip is a SIBLING of the
 * row's button, never inside it.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VirtuosoMockContext } from "react-virtuoso";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    capRowTags,
    MAX_ROW_TAGS_DESKTOP,
    MAX_ROW_TAGS_PHONE,
} from "../features/tasks/components/contents/base/capRowTags";
import {
    TaskRowMoreTags,
    TaskRowTags,
} from "../features/tasks/components/contents/base/TaskRowTags";
import { TaskSubTasksBlock } from "../features/tasks/components/contents/base/TaskSubTasksBlock";
import { loadSpecificChildTasks } from "../features/tasks/services/loadSpecificChildTasks";
import type { TeamManagementState } from "../hooks/common/useTeamManagement";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { TaskProps } from "../types/tasks";

let isPhone = false;
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => isPhone }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/tasks/services/loadSpecificChildTasks", () => ({
    loadSpecificChildTasks: vi.fn(),
}));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({ AvatarWithStatus: () => null }));

// `(hover: none)` is what a touch screen answers; jsdom has no matchMedia.
let isTouch = false;
const stubMatchMedia = () => {
    window.matchMedia = ((query: string) => ({
        matches: isTouch && query.includes("hover: none"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
        onchange: null,
    })) as unknown as typeof window.matchMedia;
};

const makeTags = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ tagName: `tag${i + 1}`, tagColor: "#336699" }));

const renderTags = (n: number, onRowClick = vi.fn()) => {
    const tags = makeTags(n);
    render(
        <CssVarsProvider>
            <div style={{ display: "flex" }}>
                <div role="button" tabIndex={0} onClick={onRowClick}>
                    <TaskRowTags tags={tags} taskId={7} />
                </div>
                <TaskRowMoreTags tags={tags} />
            </div>
        </CssVarsProvider>
    );
    return onRowClick;
};

const shownNames = () => screen.queryAllByText(/^tag\d+$/).map((el) => el.textContent);

beforeEach(() => {
    isPhone = false;
    isTouch = false;
    stubMatchMedia();
});

afterEach(() => {
    vi.mocked(loadSpecificChildTasks).mockReset();
});

describe("capRowTags", () => {
    it("keeps 2 on desktop and 1 on a phone", () => {
        expect(MAX_ROW_TAGS_DESKTOP).toBe(2);
        expect(MAX_ROW_TAGS_PHONE).toBe(1);
    });

    it.each([
        [0, 0, 0, 0, 0],
        [1, 1, 0, 1, 0],
        [2, 2, 0, 1, 1],
        [3, 2, 1, 1, 2],
        [8, 2, 6, 1, 7],
    ])(
        "%i tags: desktop shows %i hides %i, phone shows %i hides %i",
        (n, dShown, dHidden, pShown, pHidden) => {
            const tags = makeTags(n);
            const desktop = capRowTags(tags, false);
            const phone = capRowTags(tags, true);
            expect([desktop.shown.length, desktop.hidden.length]).toEqual([dShown, dHidden]);
            expect([phone.shown.length, phone.hidden.length]).toEqual([pShown, pHidden]);
            // Nothing is lost or reordered.
            expect([...desktop.shown, ...desktop.hidden]).toEqual(tags);
            expect([...phone.shown, ...phone.hidden]).toEqual(tags);
        }
    );
});

describe("TaskRowTags + TaskRowMoreTags", () => {
    it.each([
        [0, [], null],
        [1, ["tag1"], null],
        [2, ["tag1", "tag2"], null],
        [3, ["tag1", "tag2"], "+1"],
        [8, ["tag1", "tag2"], "+6"],
    ])("desktop, %i tags", (n, names, more) => {
        renderTags(n);
        expect(shownNames()).toEqual(names);
        if (more) expect(screen.getByText(more)).toBeTruthy();
        else expect(screen.queryByText(/^\+\d+$/)).toBeNull();
    });

    it.each([
        [0, [], null],
        [1, ["tag1"], null],
        [2, ["tag1"], "+1"],
        [3, ["tag1"], "+2"],
        [8, ["tag1"], "+7"],
    ])("phone, %i tags", (n, names, more) => {
        isPhone = true;
        renderTags(n);
        expect(shownNames()).toEqual(names);
        if (more) expect(screen.getByText(more)).toBeTruthy();
        else expect(screen.queryByText(/^\+\d+$/)).toBeNull();
    });

    it("gives the +N chip a keyboard-reachable button with an aria-label naming the hidden tags", () => {
        renderTags(5);
        const button = screen.getByRole("button", { name: "3 more tags: tag3, tag4, tag5" });
        expect(button.tagName).toBe("BUTTON");
        expect(button.getAttribute("tabindex")).not.toBe("-1");
    });

    it("does not open the row when +N is clicked", () => {
        const onRowClick = renderTags(4);
        fireEvent.click(screen.getByRole("button", { name: /2 more tags/ }));
        expect(onRowClick).not.toHaveBeenCalled();
    });

    it("on a touch screen a tap lists the hidden tags and a tap elsewhere closes them", async () => {
        isPhone = true;
        isTouch = true;
        renderTags(3);
        expect(screen.queryByRole("tooltip")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /2 more tags/ }));
        expect(screen.getByRole("tooltip").textContent).toBe("tag2, tag3");
        fireEvent.click(document.body);
        // Joy fades the tooltip out, so it leaves the DOM a moment later.
        await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    });

    it("on a narrow window with a mouse a click does not hold the list open (hover owns it)", () => {
        isPhone = true;
        isTouch = false;
        renderTags(3);
        fireEvent.click(screen.getByRole("button", { name: /2 more tags/ }));
        expect(screen.queryByRole("tooltip")).toBeNull();
    });
});

describe("TaskSubTasksBlock row", () => {
    it("renders the +N button outside the row's own button (no button inside a button)", async () => {
        vi.mocked(loadSpecificChildTasks).mockResolvedValue([
            {
                id: 5,
                displayId: "PRJ-5",
                title: "A task with many tags",
                status: { code: 0, status: "Open", color: "#0044c2", textColor: "white" },
                tags: makeTags(8),
                project: { projectId: 1, projectName: "P" },
            } as unknown as TaskProps,
        ]);
        render(
            <CssVarsProvider>
                <VirtuosoMockContext.Provider value={{ viewportHeight: 300, itemHeight: 44 }}>
                    <TaskSubTasksBlock
                        emptyText="none"
                        forceLoad={true}
                        myself={{ userId: "u1" } as never}
                        SectionHeader={({ children }) => <div>{children}</div>}
                        setMyself={vi.fn()}
                        socket={null}
                        useCM={{} as never}
                        useTEM={{ teamMemberProfiles: {} } as unknown as TeamManagementState}
                        useTM={{ currentPreviewTaskId: -1 } as unknown as TaskManagementState}
                        useUISM={{} as never}
                        currentTaskContent={
                            {
                                id: 1,
                                rootTaskId: 1,
                                project: { projectId: 1, projectName: "P" },
                            } as unknown as TaskProps
                        }
                    />
                </VirtuosoMockContext.Provider>
            </CssVarsProvider>
        );
        const more = await waitFor(() => screen.getByRole("button", { name: /6 more tags/ }));
        expect(more.closest('[role="button"]:not(button)')).toBeNull();
        // Only the 2 capped chips are in the row, next to the title.
        expect(screen.getByText("A task with many tags")).toBeTruthy();
        expect(shownNames()).toEqual(["tag1", "tag2"]);
    });
});
