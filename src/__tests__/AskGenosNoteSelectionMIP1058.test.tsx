/**
 * "Ask Genos about the selected text" on the toolbar over a selection in a NOTE (MIP-1058).
 *
 * The button is behaviour-tested with BlockNote's hooks stood in for (jsdom can't drive its
 * floating toolbar); the editor wiring (which note family each wrapper names, no button when the note
 * is previewed inside a link modal, no button on a task body, a template or a to-do's notes) is
 * asserted on the source, as the other editor guards in this suite do.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AskGenosToolbarButton } from "../components/editors/AskGenosToolbarButton";
import type { AgentMentionRef } from "../features/agentQA/mentions/types";
import { onAskGenosAboutSelection } from "../features/spotlight/askGenosAbout";
import { en } from "../i18n/locales/en";

const selected = vi.hoisted(() => ({ text: "" }));
vi.mock("@blocknote/react", () => ({
    useBlockNoteEditor: () => ({ getSelectedText: () => selected.text }),
    useComponentsContext: () => ({
        FormattingToolbar: {
            Button: ({
                children,
                onClick,
                label,
            }: {
                children: React.ReactNode;
                onClick: () => void;
                label?: string;
            }) => (
                <button aria-label={label} type="button" onClick={onClick}>
                    {children}
                </button>
            ),
        },
    }),
}));

afterEach(cleanup);

const NOTE: AgentMentionRef = { kind: "note", noteType: 1, noteId: 9, label: "Plan" };

describe("the toolbar button", () => {
    it("is named for what it does", () => {
        render(<AskGenosToolbarButton source={NOTE} />);
        expect(
            screen.getByRole("button", { name: en.common.editor.askGenosSelection })
        ).toBeTruthy();
    });

    it("hands the selected text over with the note as its source", () => {
        selected.text = "  the launch is Friday  ";
        render(<AskGenosToolbarButton source={NOTE} />);
        const heard = vi.fn();
        const off = onAskGenosAboutSelection(heard);
        fireEvent.click(screen.getByRole("button"));
        off();
        expect(heard).toHaveBeenCalledWith({ text: "the launch is Friday", from: NOTE });
    });

    it("hands nothing over for a blank selection", () => {
        selected.text = "   ";
        render(<AskGenosToolbarButton source={NOTE} />);
        const heard = vi.fn();
        const off = onAskGenosAboutSelection(heard);
        fireEvent.click(screen.getByRole("button"));
        off();
        expect(heard).not.toHaveBeenCalled();
    });

    it("works without a source (the passage then goes alone)", () => {
        selected.text = "text";
        render(<AskGenosToolbarButton source={null} />);
        const heard = vi.fn();
        const off = onAskGenosAboutSelection(heard);
        fireEvent.click(screen.getByRole("button"));
        off();
        expect(heard).toHaveBeenCalledWith({ text: "text" });
    });
});

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const code = (path: string) =>
    readFileSync(resolve(srcDir, path), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

describe("the wiring", () => {
    it("each note wrapper names its own family: my 1, task 2, chat 3", () => {
        expect(code("components/editors/bnMyNoteEditor.tsx")).toMatch(/noteType:\s*1,/);
        expect(code("components/editors/bnTaskNoteEditor.tsx")).toMatch(/noteType:\s*2,/);
        expect(code("components/editors/bnChatNoteEditor.tsx")).toMatch(/noteType:\s*3,/);
    });

    it("the note editor offers it with its note as the source, and not inside a link modal", () => {
        const editor = code("components/editors/genos/GenosNoteEditor.tsx");
        expect(editor).toMatch(/askGenosAvailable\s*=\s*useAskGenosAvailable\(\)/);
        expect(editor).toMatch(
            /askSource=\{\s*askGenosAvailable\s*\?\s*\{\s*kind: "note",\s*noteType: note\.noteType,\s*noteId: note\.noteId,[\s\S]*?\}\s*:\s*null\s*\}/
        );
    });

    it("the toolbar shows the button only when it is given a source", () => {
        expect(code("components/editors/genos/GenosToolbars.tsx")).toMatch(
            /\{askSource && <AskGenosToolbarButton/
        );
    });

    it("a task body, a template and a to-do's notes do not pass a source: no button there", () => {
        for (const f of [
            "components/editors/bnTaskPreview.tsx",
            "components/editors/bnLocalBodyEditor.tsx",
            "components/editors/bnTodoPreview.tsx",
        ]) {
            expect(code(f), f).not.toMatch(/askSource/);
        }
    });
});
