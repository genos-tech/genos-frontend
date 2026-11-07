// Wiring smoke test for the project-template manage modal: the
// create/delete paths POST/DELETE to `/project/task-template/` and flip
// the `templatesDirty` refetch signal. The BlockNote body editor is
// stubbed (per the codebase pattern) so this asserts the plumbing the
// pure `parseCustomTemplateValue` test can't reach — including the
// empty-body coercion when the author never touches the editor.

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { ModalManageTaskTemplates } from "../features/tasks/components/modals/ModalManageTaskTemplates";
import { CustomTaskTemplate } from "../features/tasks/utils/taskTemplates";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../hooks/common/useProjectManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import { UserProps } from "../types/admin";

// The local BlockNote editor transitively pulls in the whole BlockNote
// stack — stub it. It deliberately does NOT call `onChange`, mirroring a
// user who typed only a name and never touched the body.
vi.mock("../components/editors/bnLocalBodyEditor", () => ({
    BnLocalBodyEditor: () => <div data-testid="bn-local-body" />,
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

const myself = { userId: "u1", teamId: "t1" } as UserProps;

const existing: CustomTaskTemplate = {
    id: 5,
    templateName: "Design doc",
    body: [{ type: "paragraph", content: [{ type: "text", text: "hi", styles: {} }] }],
};

const makeTM = (overrides: Partial<TaskManagementState> = {}) =>
    ({
        projectTaskTemplates: [existing],
        setProjectTaskTemplates: vi.fn(),
        openManageTemplates: true,
        setOpenManageTemplates: vi.fn(),
        templatesDirty: false,
        setTemplatesDirty: vi.fn(),
        ...overrides,
    }) as unknown as TaskManagementState;

const renderModal = (useTM: TaskManagementState) =>
    render(
        <CssVarsProvider>
            <ModalManageTaskTemplates
                myself={myself}
                open={true}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as unknown as ChatManagementState}
                usePM={{ currentProject: { projectId: 7 } } as unknown as ProjectManagementState}
                useTEM={{} as unknown as TeamManagementState}
                useTM={useTM}
                useUISM={{} as unknown as UIStateManagementState}
                onClose={vi.fn()}
            />
        </CssVarsProvider>
    );

beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 99 }),
    }) as unknown as typeof fetch;
});

describe("ModalManageTaskTemplates", () => {
    it("lists existing project templates", () => {
        renderModal(makeTM());
        expect(screen.getByText("Design doc")).toBeTruthy();
    });

    it("creates a template with a coerced non-empty body and flips the dirty signal", async () => {
        const useTM = makeTM();
        renderModal(useTM);

        fireEvent.click(screen.getByText("New template"));
        fireEvent.change(screen.getByPlaceholderText("e.g. Design doc"), {
            target: { value: "API change" },
        });
        fireEvent.click(screen.getByText("Create"));

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(String(url)).toContain("/project/task-template/");
        expect(init.method).toBe("POST");
        const sent = JSON.parse(init.body);
        expect(sent.template_name).toBe("API change");
        expect(sent.project_id).toBe(7);
        // The author never edited the body, so it must be coerced to a
        // single paragraph — never an empty array (which would make
        // `replaceBlocks` throw when the template is applied).
        expect(Array.isArray(sent.body)).toBe(true);
        expect(sent.body.length).toBeGreaterThan(0);

        await waitFor(() => expect(useTM.setTemplatesDirty).toHaveBeenCalledWith(true));
    });

    it("does not POST when the name is blank", async () => {
        renderModal(makeTM());
        fireEvent.click(screen.getByText("New template"));
        fireEvent.click(screen.getByText("Create"));
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("deletes a template and flips the dirty signal", async () => {
        const useTM = makeTM();
        renderModal(useTM);

        // Row delete → inline confirm → Yes.
        fireEvent.click(screen.getByLabelText("Delete"));
        fireEvent.click(screen.getByText("Yes"));

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(String(url)).toContain("/project/task-template/");
        expect(init.method).toBe("DELETE");
        expect(JSON.parse(init.body).id).toBe(5);
        await waitFor(() => expect(useTM.setTemplatesDirty).toHaveBeenCalledWith(true));
    });

    it("is a ModalFrame dialog on Joy's modal layer (the BlockNote menus sit above it), flat", () => {
        renderModal(makeTM());
        const dialog = screen.getByRole("dialog");
        expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent).toBe(
            "Project templates"
        );
        expect(getComputedStyle(screen.getByRole("presentation")).zIndex).toBe("1300");
        const css = cssOf(dialog);
        expect(css).not.toMatch(/gradient/i);
        expect(css.match(/box-shadow:[^;]*/g)).toEqual(["box-shadow: var(--g-shadow-lg)"]);
    });

    it("the list view's footer closes the dialog; authoring swaps it for Cancel and Create", () => {
        const onClose = vi.fn();
        render(
            <CssVarsProvider>
                <ModalManageTaskTemplates
                    myself={{ userId: "u1", teamId: "t1" } as UserProps}
                    open={true}
                    setMyself={vi.fn()}
                    socket={null}
                    useCM={{} as unknown as ChatManagementState}
                    useTEM={{} as unknown as TeamManagementState}
                    useTM={makeTM()}
                    useUISM={{} as unknown as UIStateManagementState}
                    usePM={
                        { currentProject: { projectId: 7 } } as unknown as ProjectManagementState
                    }
                    onClose={onClose}
                />
            </CssVarsProvider>
        );
        fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
        expect(onClose).toHaveBeenCalled();
        fireEvent.click(screen.getByText("New template"));
        expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
    });
});
