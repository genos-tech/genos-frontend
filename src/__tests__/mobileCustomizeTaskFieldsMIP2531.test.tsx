/**
 * MIP-2531: the phone task home's "⋮" menu offers "Customize Task Fields" by the same rule as the
 * desktop header (owner and editors, not viewers) and opens the same dialog.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileTaskHome } from "../features/tasks/MobileTaskHome";
import { en } from "../i18n/locales/en";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../features/tasks/MobileTaskList", () => ({ MobileTaskList: () => null }));
vi.mock("../features/tasks/components/header/TaskSearchBar", () => ({
    TaskSearchBar: () => null,
}));
vi.mock("../features/tasks/components/modals/ModalCustomizeTaskFields", () => ({
    ModalCustomizeTaskFields: ({ onClose }: { onClose: () => void }) => (
        <button data-testid="customize-fields-dialog" onClick={onClose} />
    ),
}));

type Rules = { projectId: number; ownerUserId: string; canManage: boolean };

const openMenu = (userId: string, taskFieldRules: Rules | null) => {
    render(
        <MemoryRouter initialEntries={["/workspace/tasks/project/7"]}>
            <CssVarsProvider>
                <MobileTaskHome
                    myself={{ userId, teamId: "t1" } as never}
                    setMyself={vi.fn()}
                    setOpenJoinProject={vi.fn()}
                    socket={null}
                    useCM={{} as never}
                    useNM={{ tabItems: [], selectedTabIndex: 0 } as never}
                    useSM={{} as never}
                    useTEM={{} as never}
                    useUISM={{} as never}
                    usePM={
                        {
                            currentProject: { projectId: 7, projectName: "P" },
                            teamProjects: [],
                        } as never
                    }
                    useTM={
                        {
                            taskFieldRules,
                            isCreatingTask: { flag: false },
                            setIsCreatingTask: vi.fn(),
                        } as never
                    }
                    isActiveRoute
                    onCloseTaskHome={vi.fn()}
                />
            </CssVarsProvider>
        </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: en.common.ui.moreMenu.ariaLabel }));
};

const row = () =>
    screen.queryByRole("menuitem", { name: en.tasks.header.customizeFieldsMenuItem });

describe("phone project menu: Customize Task Fields (MIP-2531)", () => {
    afterEach(cleanup);

    it("shows it to the owner, right after Manage tags, and opens and closes the dialog", () => {
        openMenu("owner", { projectId: 7, ownerUserId: "owner", canManage: true });
        const labels = screen.getAllByRole("menuitem").map((m) => m.textContent);
        expect(labels.indexOf(en.tasks.header.customizeFieldsMenuItem)).toBe(
            labels.indexOf(en.tasks.mobile.manageTags) + 1
        );
        expect(screen.queryByTestId("customize-fields-dialog")).toBeNull();
        fireEvent.click(row()!);
        fireEvent.click(screen.getByTestId("customize-fields-dialog"));
        expect(screen.queryByTestId("customize-fields-dialog")).toBeNull();
    });

    it("shows it to an editor", () => {
        openMenu("editor", { projectId: 7, ownerUserId: "owner", canManage: true });
        expect(row()).not.toBeNull();
    });

    it("hides it from a viewer", () => {
        openMenu("viewer", { projectId: 7, ownerUserId: "owner", canManage: false });
        expect(row()).toBeNull();
    });

    it("hides it until the rules for this project arrive", () => {
        openMenu("owner", { projectId: 8, ownerUserId: "owner", canManage: true });
        expect(row()).toBeNull();
    });
});
