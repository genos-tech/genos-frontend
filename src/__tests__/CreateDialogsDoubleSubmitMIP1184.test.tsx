/**
 * MIP-1184: Enter, or a second click, while a create is still running must not create the
 * project / group twice, and the dialog must not be dismissible while it runs.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalCreateGM } from "../features/chat/components/modals/ModalCreateGM";
import { createChatGroup } from "../features/chat/services/createChatGroup";
import { ModalCreateProject } from "../features/tasks/components/modals/ModalCreateProject";
import { en } from "../i18n/locales/en";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/admin/services/popTeamMembers", () => ({
    popTeamMembers: vi.fn().mockResolvedValue([]),
}));
vi.mock("../features/admin/components/team/useTeamConnections", () => ({
    useTeamConnections: () => ({ active: [] }),
}));
vi.mock("../features/chat/services/createChatGroup", () => ({ createChatGroup: vi.fn() }));

const myself = { userId: "u1", teamId: "t1", userName: "Ken" } as never;

/** A promise the test settles by hand, so "the request is still running" is a state. */
const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
};

describe("ModalCreateProject", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
    });

    const mount = () => {
        const usePM = {
            openCreateProject: true,
            setOpenCreateProject: vi.fn(),
            loadProjectsAndTasks: vi.fn(),
        };
        render(
            <CssVarsProvider>
                <ModalCreateProject myself={myself} usePM={usePM as never} />
            </CssVarsProvider>
        );
        return usePM;
    };

    it("two quick Enters make one create request, and the dialog cannot be closed meanwhile", async () => {
        const first = deferred<Response>();
        vi.mocked(fetch).mockReturnValue(first.promise);
        const usePM = mount();
        const input = screen.getByPlaceholderText(en.tasks.modals.createProject.namePlaceholder);
        fireEvent.change(input, { target: { value: "Apollo" } });
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.click(
            screen.getByRole("button", { name: en.tasks.modals.createProject.createButton })
        );
        expect(fetch).toHaveBeenCalledTimes(1);
        // Esc is ignored while it runs (ModalFrame's `dismissible`).
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(usePM.setOpenCreateProject).not.toHaveBeenCalled();
        // The request ends (here: a refusal): the dialog is usable again.
        await act(async () => {
            first.resolve({ ok: false, status: 400, json: async () => ({}) } as Response);
            await first.promise;
        });
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(usePM.setOpenCreateProject).toHaveBeenCalledWith(false);
    });
});

describe("ModalCreateGM", () => {
    it("two quick Enters make one group, and the dialog cannot be closed meanwhile", async () => {
        const first = deferred<undefined>();
        vi.mocked(createChatGroup).mockReturnValue(first.promise as never);
        const setOpen = vi.fn();
        render(
            <CssVarsProvider>
                <ModalCreateGM
                    myself={myself}
                    open
                    setOpen={setOpen}
                    socket={null}
                    useCM={{} as never}
                    useTEM={{ teamMembers: [] } as never}
                    useUISM={{} as never}
                    setMyself={vi.fn()}
                />
            </CssVarsProvider>
        );
        const input = screen.getByPlaceholderText(en.chat.modals.createGM.groupNamePlaceholder);
        fireEvent.change(input, { target: { value: "Team chat" } });
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(createChatGroup).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(setOpen).not.toHaveBeenCalled();
        await act(async () => {
            first.resolve(undefined);
            await first.promise;
        });
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(setOpen).toHaveBeenCalledWith(false);
    });
});
