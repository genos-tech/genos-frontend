/**
 * MIP-2211: a skill's tags are pre-defined chips. The editor's Tags field picks from the member's
 * catalog and creates, renames, recolours and deletes in the same "Manage tags" dialog the to-do
 * list has; there is no free-text entry. Every network edge is mocked: what is pinned is which
 * request each action sends and what the field does with each answer.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../features/genos/skills/skillsApi";
import { SkillTagsField } from "../features/genos/skills/SkillTagsField";
import { I18nProvider } from "../i18n";

vi.mock("../context/authState", () => ({
    useAuth: () => ({ accessToken: "tok" }),
}));

vi.mock("../features/genos/skills/skillsApi", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../features/genos/skills/skillsApi")>();
    return {
        ...actual,
        fetchSkillTags: vi.fn(),
        createSkillTag: vi.fn(),
        updateSkillTag: vi.fn(),
        deleteSkillTag: vi.fn(),
    };
});

const tag = (tagId: number, name: string, color = "#808080"): api.SkillTag => ({
    tagId,
    name,
    color,
    textColor: "white",
});
const CATALOG = [tag(1, "weekly", "#1dc200"), tag(2, "planning", "#0044c2"), tag(3, "ops")];

const onChange = vi.fn();
const onCatalogRewrite = vi.fn();

const renderField = (props: Partial<React.ComponentProps<typeof SkillTagsField>> = {}) =>
    render(
        <CssVarsProvider>
            <I18nProvider>
                <SkillTagsField
                    disabled={false}
                    selected={["weekly"]}
                    skillId="s1"
                    teamId="team-1"
                    onCatalogRewrite={onCatalogRewrite}
                    onChange={onChange}
                    {...props}
                />
            </I18nProvider>
        </CssVarsProvider>
    );

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchSkillTags).mockResolvedValue({
        ok: true,
        data: { tags: CATALOG, editable: true },
    });
});
afterEach(cleanup);

const openPicker = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(await screen.findByRole("button", { name: "Add a tag" }));

describe("the Tags field", () => {
    it("reads the owner's catalog of this skill and draws the chosen tags as chips", async () => {
        renderField();
        expect(await screen.findByRole("button", { name: "Add a tag" })).toBeTruthy();
        expect(api.fetchSkillTags).toHaveBeenCalledWith("tok", { skillId: "s1" });
        expect(screen.getByText("weekly")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Remove tag weekly" })).toBeTruthy();
    });

    it("has no text input for a tag", async () => {
        renderField();
        await screen.findByRole("button", { name: "Add a tag" });
        expect(screen.queryByRole("textbox")).toBeNull();
    });

    it("picks from the list and takes a chip off", async () => {
        const user = userEvent.setup();
        renderField();
        await openPicker(user);
        await user.click(await screen.findByRole("menuitem", { name: /planning/ }));
        expect(onChange).toHaveBeenLastCalledWith(["weekly", "planning"]);
        await user.click(screen.getByRole("button", { name: "Remove tag weekly" }));
        expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it("unticks a chosen tag in the menu", async () => {
        const user = userEvent.setup();
        renderField();
        await openPicker(user);
        await user.click(await screen.findByRole("menuitem", { name: /weekly/ }));
        expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it("offers no more once five are chosen", async () => {
        const user = userEvent.setup();
        renderField({ selected: ["a1", "b2", "c3", "d4", "weekly"] });
        await openPicker(user);
        const planning = await screen.findByRole("menuitem", { name: /planning/ });
        expect(planning.getAttribute("aria-disabled")).toBe("true");
        // A chosen one can still be unticked.
        expect(
            screen.getByRole("menuitem", { name: /weekly/ }).getAttribute("aria-disabled")
        ).not.toBe("true");
        expect(onChange).not.toHaveBeenCalled();
    });

    it("tells a co-editor the list is the owner's and offers no Manage tags", async () => {
        vi.mocked(api.fetchSkillTags).mockResolvedValue({
            ok: true,
            data: { tags: CATALOG, editable: false },
        });
        const user = userEvent.setup();
        renderField();
        await openPicker(user);
        expect(await screen.findByRole("menuitem", { name: /planning/ })).toBeTruthy();
        expect(screen.queryByRole("menuitem", { name: "Manage tags" })).toBeNull();
        expect(screen.getByText(/Only the owner can change the tag list/)).toBeTruthy();
    });

    it("shows the chips but no picker on a skill that cannot be edited", async () => {
        renderField({ disabled: true });
        expect(await screen.findByText("weekly")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Add a tag" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Remove tag weekly" })).toBeNull();
    });

    it("says so when the list cannot be loaded, and draws the tags in grey", async () => {
        vi.mocked(api.fetchSkillTags).mockResolvedValue({
            ok: false,
            reason: "error",
            message: "",
        });
        renderField();
        expect(await screen.findByText("Couldn't load the tag list.")).toBeTruthy();
        expect(screen.getByText("weekly")).toBeTruthy();
    });
});

describe("Manage tags", () => {
    const openManage = async (user: ReturnType<typeof userEvent.setup>) => {
        await openPicker(user);
        await user.click(await screen.findByRole("menuitem", { name: "Manage tags" }));
        return screen.findByRole("dialog");
    };

    it("lists every tag of the catalog", async () => {
        const user = userEvent.setup();
        renderField();
        const dialog = await openManage(user);
        expect(within(dialog).getAllByTestId(/^skill-tag-row-/)).toHaveLength(3);
    });

    it("creates a tag lower-cased and lets the server choose its colour", async () => {
        vi.mocked(api.createSkillTag).mockResolvedValue({
            ok: true,
            data: tag(9, "research", "#4682b4"),
        });
        const user = userEvent.setup();
        renderField();
        const dialog = await openManage(user);
        await user.type(within(dialog).getByLabelText("New tag"), " Research ");
        await user.click(within(dialog).getByRole("button", { name: "Add" }));
        await waitFor(() => expect(api.createSkillTag).toHaveBeenCalled());
        expect(api.createSkillTag).toHaveBeenCalledWith("tok", "team-1", { name: "research" });
        expect(await within(dialog).findByTestId("skill-tag-row-9")).toBeTruthy();
    });

    it("refuses a name outside the rules or one it already has, before asking the server", async () => {
        const user = userEvent.setup();
        renderField();
        const dialog = await openManage(user);
        const input = within(dialog).getByLabelText("New tag");
        await user.type(input, "Two Words");
        await user.click(within(dialog).getByRole("button", { name: "Add" }));
        expect(
            await within(dialog).findByText(/Use lower-case letters, digits and hyphens/)
        ).toBeTruthy();
        await user.clear(input);
        await user.type(input, "ops");
        await user.click(within(dialog).getByRole("button", { name: "Add" }));
        expect(within(dialog).getByText(/Use lower-case letters/)).toBeTruthy();
        expect(api.createSkillTag).not.toHaveBeenCalled();
    });

    it("shows a failed save", async () => {
        vi.mocked(api.createSkillTag).mockResolvedValue({
            ok: false,
            reason: "conflict",
            message: "You already have a tag with that name.",
        });
        const user = userEvent.setup();
        renderField();
        const dialog = await openManage(user);
        await user.type(within(dialog).getByLabelText("New tag"), "fresh");
        await user.click(within(dialog).getByRole("button", { name: "Add" }));
        expect(
            await within(dialog).findByText("Couldn't save the tag. Please try again.")
        ).toBeTruthy();
    });

    it("renames a tag and tells the editor to rename it on the skill", async () => {
        vi.mocked(api.updateSkillTag).mockResolvedValue({
            ok: true,
            data: tag(1, "status", "#1dc200"),
        });
        const user = userEvent.setup();
        renderField();
        const dialog = await openManage(user);
        await user.click(within(dialog).getAllByRole("button", { name: "Rename tag: weekly" })[0]);
        const input = await within(dialog).findByDisplayValue("weekly");
        await user.clear(input);
        await user.type(input, "status{Enter}");
        await waitFor(() => expect(api.updateSkillTag).toHaveBeenCalled());
        expect(api.updateSkillTag).toHaveBeenCalledWith("tok", 1, { name: "status" });
        expect(onCatalogRewrite).toHaveBeenCalledWith("weekly", "status");
    });

    it("deletes after a second click and tells the editor to drop the name", async () => {
        vi.mocked(api.deleteSkillTag).mockResolvedValue({ ok: true, data: null });
        const user = userEvent.setup();
        renderField();
        const dialog = await openManage(user);
        await user.click(within(dialog).getByRole("button", { name: "Delete tag: weekly" }));
        expect(api.deleteSkillTag).not.toHaveBeenCalled();
        expect(within(dialog).getByText(/Readers keep seeing it on a version/)).toBeTruthy();
        await user.click(within(dialog).getByRole("button", { name: "Delete" }));
        await waitFor(() => expect(api.deleteSkillTag).toHaveBeenCalledWith("tok", 1));
        expect(onCatalogRewrite).toHaveBeenCalledWith("weekly", null);
        await waitFor(() => expect(within(dialog).queryByTestId("skill-tag-row-1")).toBeNull());
    });

    it("recolours without renaming", async () => {
        vi.mocked(api.updateSkillTag).mockResolvedValue({
            ok: true,
            data: tag(3, "ops", "#ff2323"),
        });
        const user = userEvent.setup();
        renderField();
        const dialog = await openManage(user);
        const row = within(dialog).getByTestId("skill-tag-row-3");
        await user.click(within(row).getAllByRole("button")[0]);
        await user.click(await screen.findByRole("menuitem", { name: /Red/ }));
        await waitFor(() => expect(api.updateSkillTag).toHaveBeenCalled());
        expect(vi.mocked(api.updateSkillTag).mock.calls[0][2]).toMatchObject({ color: "#ff2323" });
        expect(onCatalogRewrite).not.toHaveBeenCalled();
    });
});

describe("chips on a skill row", () => {
    it("uses the server's colours, and grey for a server that sends none", () => {
        expect(
            api.chipsOf({
                tags: ["a"],
                tagChips: [{ name: "a", color: "#1dc200", textColor: "white" }],
            })
        ).toEqual([{ name: "a", color: "#1dc200", textColor: "white" }]);
        // No colour at all: the chip draws its neutral dot.
        expect(api.chipsOf({ tags: ["a", "b"] })).toEqual([
            { name: "a", color: "", textColor: "white" },
            { name: "b", color: "", textColor: "white" },
        ]);
    });

    it("parses the catalog and drops a row that is not a tag", () => {
        const parsed = api.parseSkillTagCatalog({
            tags: [
                { tagId: 1, name: "a", color: "#abcdef", textColor: "black" },
                { tagId: "x", name: "b", color: "#abcdef" },
                { tagId: 3, name: "c", color: "not-a-colour" },
                null,
            ],
            editable: true,
        });
        expect(parsed?.editable).toBe(true);
        expect(parsed?.tags.map((t) => [t.name, t.color])).toEqual([
            ["a", "#abcdef"],
            ["c", ""],
        ]);
        expect(api.parseSkillTagCatalog({})).toBeNull();
    });
});
