/**
 * MIP-2209: the Skills editor's icon is an emoji picked from the app's emoji picker, its Editors
 * field uses the shared person picker, and its instructions editor has no "Unwrap" toggles or
 * "Show comments" button, while every other note editor keeps them.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SkillIconField } from "../features/genos/skills/SkillIconField";
import { I18nProvider } from "../i18n";

// The real picker is emoji-mart (code-split, huge); what matters here is what the field passes it
// and what it does with the answer.
type PickerProps = {
    includeCustom?: boolean;
    showEmojiPicker: boolean;
    useFixedPosition?: boolean;
    setSelectedEmoji: (emoji: string | null) => void;
    setShowEmojiPicker: (shown: boolean) => void;
};
const picker = vi.hoisted(() => ({ last: null as PickerProps | null }));
vi.mock("../components/ui/emoji/EmojiPicker", () => ({
    EmojiPicker: (props: PickerProps) => {
        picker.last = props;
        return <div data-testid="emoji-picker" />;
    },
}));

const renderField = (value: string, onChange = vi.fn(), disabled = false) => {
    render(
        <CssVarsProvider>
            <I18nProvider>
                <SkillIconField disabled={disabled} value={value} onChange={onChange} />
            </I18nProvider>
        </CssVarsProvider>
    );
    return onChange;
};

afterEach(() => {
    cleanup();
    picker.last = null;
});

describe("the icon field", () => {
    it("is a button that opens the emoji picker, not a text box", async () => {
        renderField("");
        expect(screen.queryByRole("textbox")).toBeNull();
        expect(screen.queryByTestId("emoji-picker")).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "Choose an emoji" }));
        expect(screen.getByTestId("emoji-picker")).toBeTruthy();
        // Fixed, so a modal's overflow does not clip it; no team emoji, an icon is plain text.
        expect(picker.last?.useFixedPosition).toBe(true);
        expect(picker.last?.includeCustom).toBe(false);
    });

    it("stores the picked emoji in the icon", async () => {
        const onChange = renderField("");
        await userEvent.click(screen.getByRole("button", { name: "Choose an emoji" }));
        picker.last?.setSelectedEmoji("🚀");
        expect(onChange).toHaveBeenCalledWith("🚀");
    });

    it("ignores the picker's null (a click outside it)", async () => {
        const onChange = renderField("⚡");
        await userEvent.click(screen.getByRole("button", { name: /Choose an emoji/ }));
        const props = picker.last!;
        props.setSelectedEmoji(null);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("shows the current emoji, and an older text icon as it is", () => {
        renderField("⚡");
        expect(screen.getByRole("button", { name: "Choose an emoji: ⚡" }).textContent).toBe("⚡");
        cleanup();
        renderField("bolt");
        expect(screen.getByRole("button", { name: "Choose an emoji: bolt" }).textContent).toBe(
            "bolt"
        );
    });

    it("removes the icon with its own button, only when there is one", async () => {
        const onChange = renderField("⚡");
        await userEvent.click(screen.getByRole("button", { name: "Remove the icon" }));
        expect(onChange).toHaveBeenCalledWith("");
        cleanup();
        renderField("");
        expect(screen.queryByRole("button", { name: "Remove the icon" })).toBeNull();
    });

    it("cannot be changed or cleared while the skill is read-only", () => {
        renderField("⚡", vi.fn(), true);
        expect(
            (screen.getByRole("button", { name: /Choose an emoji/ }) as HTMLButtonElement).disabled
        ).toBe(true);
        expect(screen.queryByRole("button", { name: "Remove the icon" })).toBeNull();
    });
});

// ─── the note editor keeps "Unwrap" and "Show comments" everywhere but here ───────────────────

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) =>
    readFileSync(join(SRC, path), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
        return /\.tsx?$/.test(name) ? [full] : [];
    });

describe("the shared note editor's top-right controls", () => {
    const editor = read("components/editors/genos/GenosNoteEditor.tsx");

    it("the option is off unless a caller turns it on", () => {
        expect(editor).toMatch(/hideViewControls = false/);
    });

    it("both the comments button and the unwrap toggles are drawn only when it is off", () => {
        expect(editor).toMatch(
            /threadStore && !hideViewControls && \(\s*<Box\s+ref=\{commentsToggleRef\}/
        );
        expect(editor).toMatch(/!hideViewControls && \(\s*<WrapToggleButtons/);
        // The only places either control is drawn.
        expect(editor.match(/<CommentsSidebarToggle/g)).toHaveLength(1);
        expect(editor.match(/<WrapToggleButtons/g)).toHaveLength(1);
    });

    it("the note and task note editors do not turn it on (they still show both)", () => {
        expect(read("components/editors/bnMyNoteEditor.tsx")).not.toContain("hideViewControls");
        expect(read("components/editors/bnTaskNoteEditor.tsx")).not.toContain("hideViewControls");
        expect(read("components/editors/bnChatNoteEditor.tsx")).not.toContain("hideViewControls");
    });

    it("only the Skills editor's body turns it on", () => {
        const users = sourceFiles(SRC)
            .filter((file) => /hideViewControls/.test(readFileSync(file, "utf8")))
            .map((file) => relative(SRC, file))
            .sort();
        expect(users).toEqual([
            "components/editors/genos/GenosNoteEditor.tsx",
            "features/genos/skills/SkillBodyEditor.tsx",
        ]);
        expect(read("features/genos/skills/SkillBodyEditor.tsx")).toMatch(
            /\n\s*hideViewControls\s*\n/
        );
    });
});

describe("the Editors field", () => {
    const field = read("features/genos/skills/SkillEditorsField.tsx");

    it("uses the shared person picker, not a plain select", () => {
        expect(field).toContain('from "../../../components/ui/PersonPicker"');
        expect(field).toContain("<PersonPicker");
        expect(field).not.toMatch(/<Select\b/);
    });
});
