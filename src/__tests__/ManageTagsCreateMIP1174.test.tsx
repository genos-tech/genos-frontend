/**
 * MIP-1174: tags are created, renamed and deleted in ONE dialog ("Manage Tags").
 * The "New Tag" dialog and the two tag icon buttons in the task preview are gone.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModalManageTags } from "../features/tasks/components/modals/ModalManageTags";
import { en } from "../i18n/locales/en";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8");

const tags = [{ tagName: "bug", tagColor: "#ff0000", tagTextColor: "white" }];

const mount = () => {
    const setProjectTags = vi.fn();
    const useTM = { setIsNewTagCreated: vi.fn(), bumpTagsRevision: vi.fn() };
    const usePM = { currentProject: { projectId: 7 } };
    render(
        <CssVarsProvider>
            <ModalManageTags
                myself={{ teamId: "team-1" } as never}
                open
                projectTags={tags}
                setProjectTags={setProjectTags}
                usePM={usePM as never}
                useTM={useTM as never}
                onClose={vi.fn()}
            />
        </CssVarsProvider>
    );
    return { setProjectTags, useTM };
};

const newTagButton = () => screen.getByRole("button", { name: en.tasks.modals.manageTags.newTag });
const nameInput = () => screen.getByRole("textbox");
const save = () => screen.getByRole("button", { name: en.tasks.modals.manageTags.saveTooltip });

describe("Manage Tags creates tags (MIP-1174)", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
    });

    it("offers a New Tag button that opens an empty name row", () => {
        mount();
        expect(screen.queryByRole("textbox")).toBeNull();
        fireEvent.click(newTagButton());
        expect((nameInput() as HTMLInputElement).value).toBe("");
        // One new row at a time.
        expect(newTagButton().hasAttribute("disabled")).toBe(true);
    });

    it("refuses an empty name and a name with spaces, without calling the API", () => {
        mount();
        fireEvent.click(newTagButton());
        fireEvent.change(nameInput(), { target: { value: "two words" } });
        fireEvent.click(save());
        expect(screen.getByText(en.tasks.modals.createTag.nameNoSpaces)).toBeTruthy();
        expect(fetch).not.toHaveBeenCalled();
    });

    it("creates the tag, adds it to the list and republishes the project's tags", async () => {
        vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
        const { setProjectTags, useTM } = mount();
        fireEvent.click(newTagButton());
        fireEvent.change(nameInput(), { target: { value: "feature" } });
        fireEvent.click(save());
        await waitFor(() => expect(setProjectTags).toHaveBeenCalled());
        const [url, init] = vi.mocked(fetch).mock.calls[0];
        expect(String(url)).toMatch(/\/project\/tag\/$/);
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ team_id: "team-1", project_id: 7, tag_name: "feature" });
        expect(setProjectTags.mock.calls[0][0].map((t: { tagName: string }) => t.tagName)).toEqual(
            ["bug", "feature"]
        );
        expect(useTM.bumpTagsRevision).toHaveBeenCalled();
        expect(useTM.setIsNewTagCreated).toHaveBeenCalledWith(true);
    });

    it("shows the server's hint when the create fails, and keeps the row open", async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            json: async () => ({ hint: "Tag already exists" }),
        } as Response);
        const { setProjectTags } = mount();
        vi.spyOn(console, "error").mockImplementation(() => {});
        fireEvent.click(newTagButton());
        fireEvent.change(nameInput(), { target: { value: "bug" } });
        fireEvent.click(save());
        await screen.findByText(/Tag already exists/);
        expect(setProjectTags).not.toHaveBeenCalled();
        expect(screen.getByRole("textbox")).toBeTruthy();
    });
});

describe("the other tag entry points are gone (MIP-1174)", () => {
    it("the task preview's tags row has no create / manage icon buttons", () => {
        const main = source("features/tasks/components/contents/base/TaskMainBlock.tsx");
        expect(main).not.toContain("ModalManageTags");
        expect(main).not.toContain("setOpenManageTags");
        expect(main).not.toMatch(/tooltips\.(createNewTag|manageTags)/);
    });

    it("no 'New Tag' menu item or dialog is left; every menu says Manage Tags", () => {
        for (const file of [
            "features/tasks/components/contents/base/TaskTitleBlock.tsx",
            "features/tasks/components/contents/TaskPreview.tsx",
            "features/tasks/components/header/TaskHeader.tsx",
            "features/tasks/MobileTaskHome.tsx",
        ]) {
            const text = source(file);
            expect(text, file).not.toMatch(/newTag|newTagMenuItem|createNewTag/);
            expect(text, file).toMatch(/manageTags/);
        }
        expect(() => source("features/tasks/components/modals/ModalCreateTag.tsx")).toThrow();
    });
});
