// "New note from template…" picker (MIP-2337): groups, preview, keyboard, use, personal create.

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalNoteTemplates } from "../features/notes/templates/ModalNoteTemplates";
import type { TeamNoteTemplate } from "../features/notes/templates/teamNoteTemplates";
import type { UserProps } from "../types/admin";

const api = vi.hoisted(() => ({
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
}));
vi.mock("../services/api", () => ({ authApi: () => api }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
// BlockNote pulls in the whole editor stack: the preview is stubbed and shows the block count.
vi.mock("../features/notes/templates/NoteTemplatePreview", () => ({
    NoteTemplatePreview: ({ blocks }: { blocks: unknown[] }) => (
        <div data-testid="preview">{blocks.length} blocks</div>
    ),
}));

const myself = { userId: "u1", teamId: "t1" } as UserProps;
const row = (
    templateId: number,
    name: string,
    over: Partial<TeamNoteTemplate> = {}
): TeamNoteTemplate => ({
    templateId,
    scope: "team",
    teamId: "t1",
    name,
    title: `${name} title`,
    defaultFolderId: null,
    createdBy: "u1",
    createdByName: "ann",
    ...over,
});

const renderModal = (templates: TeamNoteTemplate[], over: Record<string, unknown> = {}) => {
    const onUse = vi.fn();
    const onChanged = vi.fn();
    render(
        <CssVarsProvider>
            <ModalNoteTemplates
                folders={[]}
                myself={myself}
                templates={templates}
                open
                onChanged={onChanged}
                onClose={vi.fn()}
                onUse={onUse}
                {...over}
            />
        </CssVarsProvider>
    );
    return { onUse, onChanged };
};

beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { ...row(7, "Weekly"), body: [{}, {}, {}] } });
});

describe("note template picker (MIP-2337)", () => {
    it("lists built-in, team and personal templates in groups and previews the first", () => {
        renderModal([row(7, "Weekly"), row(8, "Mine", { scope: "personal", teamId: null })]);
        const options = screen.getAllByRole("option").map((o) => o.textContent);
        expect(options).toEqual([
            "Meeting notes",
            "Decision record",
            "Project brief",
            "Weekly",
            "Mine",
        ]);
        expect(screen.getByRole("group", { name: "Built-in" })).toBeTruthy();
        expect(screen.getByRole("group", { name: "Team" })).toBeTruthy();
        expect(screen.getByRole("group", { name: "My templates" })).toBeTruthy();
        // A built-in previews at once, with no request.
        expect(screen.getByTestId("preview").textContent).toMatch(/blocks/);
        expect(api.get).not.toHaveBeenCalled();
    });

    it("reads a template's body when it is selected and shows its preview", async () => {
        renderModal([row(7, "Weekly")]);
        fireEvent.click(screen.getByRole("option", { name: "Weekly" }));
        await waitFor(() => expect(screen.getByTestId("preview").textContent).toBe("3 blocks"));
        expect(api.get).toHaveBeenCalledWith("/note/template/", {
            params: { team_id: "t1", template_id: 7 },
        });
    });

    it("arrow keys move the selection and Enter uses the template", async () => {
        const { onUse } = renderModal([row(7, "Weekly")]);
        const list = screen.getByRole("listbox");
        fireEvent.keyDown(list, { key: "ArrowDown" });
        expect(
            screen.getByRole("option", { name: "Decision record" }).getAttribute("aria-selected")
        ).toBe("true");
        fireEvent.keyDown(list, { key: "End" });
        fireEvent.keyDown(list, { key: "Enter" });
        expect(onUse).toHaveBeenCalledWith({ kind: "team", templateId: 7 });
        await waitFor(() => expect(api.get).toHaveBeenCalled());
    });

    it("the button uses the selected built-in", () => {
        const { onUse } = renderModal([]);
        fireEvent.click(screen.getByRole("button", { name: "Use this template" }));
        expect(onUse).toHaveBeenCalledWith({ kind: "builtin", id: "meeting" });
    });

    it("offers edit and delete on my own templates only", async () => {
        renderModal([row(7, "Theirs", { createdBy: "u2" }), row(8, "Mine", { createdBy: "u1" })]);
        fireEvent.click(screen.getByRole("option", { name: "Theirs" }));
        expect(screen.queryByRole("button", { name: /^Delete: Theirs/ })).toBeNull();
        fireEvent.click(screen.getByRole("option", { name: "Mine" }));
        expect(screen.getByRole("button", { name: /^Delete: Mine/ })).toBeTruthy();
        await waitFor(() => expect(api.get).toHaveBeenCalled());
    });

    it("delete asks first, then deletes and reports the change", async () => {
        api.delete.mockResolvedValueOnce({});
        const { onChanged } = renderModal([row(8, "Mine")]);
        fireEvent.click(screen.getByRole("option", { name: "Mine" }));
        fireEvent.click(screen.getByRole("button", { name: /^Delete: Mine/ }));
        expect(api.delete).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Delete" }));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
        expect(api.delete).toHaveBeenCalledWith("/note/template/", {
            data: { team_id: "t1", template_id: 8 },
        });
    });

    it("a new template defaults to personal and is created with scope personal", async () => {
        api.post.mockResolvedValueOnce({
            data: { ...row(9, "Retro", { scope: "personal" }), body: [] },
        });
        const { onChanged } = renderModal([]);
        fireEvent.click(screen.getByRole("button", { name: "New template" }));
        fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Retro" } });
        // The folder default belongs to team templates only.
        expect(screen.queryByText("Default for folder")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
        expect(api.post.mock.calls[0][1]).toMatchObject({
            team_id: "t1",
            scope: "personal",
            name: "Retro",
        });
    });
});
