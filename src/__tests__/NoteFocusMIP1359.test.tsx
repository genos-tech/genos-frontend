/**
 * MIP-1359: the note's Focus view, and the close paths that used to undo it.
 *
 * Bug: closing a milestone preview opened from a note re-enabled the table
 * (its fallback ignored the note pane), and with the table back nothing could
 * hide it again. One shared rule now counts the note pane.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { NoteFocusButton } from "../features/notes/common/components/NoteFocusButton";
import { NoteHeaderActions } from "../features/notes/common/components/NoteHeaderActions";
import {
    enterChatNoteFocus,
    enterTaskNoteFocus,
    exitChatNoteFocus,
    exitTaskNoteFocus,
    isChatNoteFocused,
    isTaskNoteFocused,
} from "../features/notes/common/utils/noteFocus";
import { shouldFallBackToTable } from "../features/tasks/utils/mainPanelVisibility";
import { ar } from "../i18n/locales/ar";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { hi } from "../i18n/locales/hi";
import { ja } from "../i18n/locales/ja";
import { zh } from "../i18n/locales/zh";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));
vi.mock("../services/notifications/NotificationsContext", () => ({
    useNotificationsContext: () => ({
        isTargetMutedByKey: () => false,
        setTargetMutedByKey: vi.fn(),
    }),
}));
vi.mock("../features/notes/common/components/ModalNoteSharing", () => ({
    ModalNoteSharing: () => <div />,
}));
vi.mock("../features/notes/common/components/ModalNoteHistory", () => ({
    ModalNoteHistory: () => <div />,
}));
vi.mock("../features/notes/common/components/ModalImportMarkdown", () => ({
    ModalImportMarkdown: () => <div />,
}));

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(HERE, "..", rel), "utf8");

const tm = (over: Record<string, unknown> = {}) => ({
    isTaskTableVisible: false,
    isSprintBoardVisible: false,
    isTaskDashboardVisible: false,
    isTaskPreviewVisible: false,
    isCreatingTask: { flag: false },
    ...over,
});

describe("shouldFallBackToTable", () => {
    it("restores the table when nothing at all is on screen", () => {
        expect(shouldFallBackToTable(tm(), false)).toBe(true);
    });
    it("does NOT when the note pane is on screen (the bug)", () => {
        expect(shouldFallBackToTable(tm(), true)).toBe(false);
    });
    it("does not when a main panel is already up", () => {
        expect(shouldFallBackToTable(tm({ isTaskDashboardVisible: true }), false)).toBe(false);
        expect(shouldFallBackToTable(tm({ isTaskTableVisible: true }), false)).toBe(false);
        expect(shouldFallBackToTable(tm({ isSprintBoardVisible: true }), false)).toBe(false);
    });
});

describe("task note focus", () => {
    it("is focused only when the note is alone beside the sidebar", () => {
        expect(isTaskNoteFocused(tm() as never, true)).toBe(true);
        expect(isTaskNoteFocused(tm({ isTaskTableVisible: true }) as never, true)).toBe(false);
        expect(isTaskNoteFocused(tm({ isSprintBoardVisible: true }) as never, true)).toBe(false);
        expect(isTaskNoteFocused(tm({ isTaskDashboardVisible: true }) as never, true)).toBe(false);
        expect(isTaskNoteFocused(tm({ isTaskPreviewVisible: true }) as never, true)).toBe(false);
        expect(isTaskNoteFocused(tm({ isCreatingTask: { flag: true } }) as never, true)).toBe(
            false
        );
        // No note on screen: nothing to be focused on.
        expect(isTaskNoteFocused(tm() as never, false)).toBe(false);
    });

    it("entering hides all three main panels and the preview, and never touches a draft", () => {
        const api = {
            setIsTaskTableVisible: vi.fn(),
            setIsSprintBoardVisible: vi.fn(),
            setIsTaskDashboardVisible: vi.fn(),
            closeTaskPreview: vi.fn(),
            setIsCreatingTask: vi.fn(),
        };
        enterTaskNoteFocus(api);
        expect(api.setIsTaskTableVisible).toHaveBeenCalledWith(false);
        expect(api.setIsSprintBoardVisible).toHaveBeenCalledWith(false);
        expect(api.setIsTaskDashboardVisible).toHaveBeenCalledWith(false);
        expect(api.closeTaskPreview).toHaveBeenCalledTimes(1);
        expect(api.setIsCreatingTask).not.toHaveBeenCalled();
    });

    it("exiting puts the table back", () => {
        const api = { setIsTaskTableVisible: vi.fn() };
        exitTaskNoteFocus(api);
        expect(api.setIsTaskTableVisible).toHaveBeenCalledWith(true);
    });
});

describe("chat note focus", () => {
    const cm = (over: Record<string, unknown> = {}) => ({
        isMainChatVisible: false,
        isThreadVisible: false,
        ...over,
    });
    it("is focused only when no chat, thread, preview or draft is beside the note", () => {
        expect(isChatNoteFocused(cm() as never, tm() as never, true)).toBe(true);
        expect(
            isChatNoteFocused(cm({ isMainChatVisible: true }) as never, tm() as never, true)
        ).toBe(false);
        expect(
            isChatNoteFocused(cm({ isThreadVisible: true }) as never, tm() as never, true)
        ).toBe(false);
        expect(
            isChatNoteFocused(cm() as never, tm({ isTaskPreviewVisible: true }) as never, true)
        ).toBe(false);
        expect(
            isChatNoteFocused(cm() as never, tm({ isCreatingTask: { flag: true } }) as never, true)
        ).toBe(false);
        expect(isChatNoteFocused(cm() as never, tm() as never, false)).toBe(false);
    });

    it("enter hides chat, thread and preview; exit brings the chat back", () => {
        const cmApi = { setIsMainChatVisible: vi.fn(), setIsThreadVisible: vi.fn() };
        const tmApi = { closeTaskPreview: vi.fn() };
        enterChatNoteFocus(cmApi, tmApi);
        expect(cmApi.setIsMainChatVisible).toHaveBeenCalledWith(false);
        expect(cmApi.setIsThreadVisible).toHaveBeenCalledWith(false);
        expect(tmApi.closeTaskPreview).toHaveBeenCalledTimes(1);
        exitChatNoteFocus(cmApi);
        expect(cmApi.setIsMainChatVisible).toHaveBeenLastCalledWith(true);
    });
});

describe("NoteFocusButton", () => {
    const view = (focused: boolean, onToggle = vi.fn()) => {
        render(
            <CssVarsProvider>
                <NoteFocusButton focused={focused} onToggle={onToggle} />
            </CssVarsProvider>
        );
        return onToggle;
    };
    it("offers Focus, then the way back", () => {
        const { unmount } = render(
            <CssVarsProvider>
                <NoteFocusButton focused={false} onToggle={vi.fn()} />
            </CssVarsProvider>
        );
        const off = screen.getByTestId("note-focus-button");
        expect(off.getAttribute("aria-pressed")).toBe("false");
        expect(off.getAttribute("aria-label")).toBe(en.notes.header.focusNote);
        unmount();
        view(true);
        const on = screen.getByTestId("note-focus-button");
        expect(on.getAttribute("aria-pressed")).toBe("true");
        expect(on.getAttribute("aria-label")).toBe(en.notes.header.exitFocusNote);
    });
    it("calls onToggle on click", () => {
        const onToggle = view(false);
        fireEvent.click(screen.getByTestId("note-focus-button"));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });
});

describe("NoteHeaderActions focus slot", () => {
    const useNM = {
        currentChatNote: null,
        currentMyNote: { body: [], noteId: 1, title: "A note" },
        currentNoteMembers: [],
        currentNoteVersions: [],
        myNoteFolders: [],
        myNoteMeta: [],
        currentTaskNote: null,
        loadNote: vi.fn(),
        setIsTaskNoteVisible: vi.fn(),
    } as never;
    const renderActions = (
        isInTaskPage: boolean,
        focus?: { active: boolean; onToggle: () => void }
    ) =>
        render(
            <MemoryRouter>
                <CssVarsProvider>
                    <NoteHeaderActions
                        currentTask={undefined}
                        focus={focus}
                        isInTaskPage={isInTaskPage}
                        myself={{ userId: "u1", userName: "Me" } as never}
                        noteType={1}
                        pmChat={undefined}
                        setMyself={vi.fn()}
                        socket={null}
                        useCM={{} as never}
                        useNM={useNM}
                        useTEM={{ teamMembers: [] } as never}
                        useUISM={{} as never}
                        onCloseNotes={vi.fn()}
                        onCreateChildNote={vi.fn()}
                        onCreateNewNote={vi.fn()}
                        onDeleteNote={vi.fn()}
                        onOpenTask={vi.fn()}
                    />
                </CssVarsProvider>
            </MemoryRouter>
        );
    it("shows the button in the task page and wires the click", () => {
        const onToggle = vi.fn();
        renderActions(true, { active: false, onToggle });
        fireEvent.click(screen.getByTestId("note-focus-button"));
        expect(onToggle).toHaveBeenCalledTimes(1);
    });
    it("shows nothing outside the task page, or when no focus is offered", () => {
        renderActions(false, { active: false, onToggle: vi.fn() });
        expect(screen.queryByTestId("note-focus-button")).toBeNull();
    });
    it("shows nothing when the host offers no focus", () => {
        renderActions(true, undefined);
        expect(screen.queryByTestId("note-focus-button")).toBeNull();
    });
});

describe("wiring", () => {
    it("every close path asks the shared note-aware rule, none the bare predicate", () => {
        for (const rel of [
            "features/tasks/components/contents/TaskPreview.tsx",
            "features/tasks/components/contents/base/TaskTitleBlock.tsx",
        ]) {
            const src = read(rel);
            expect(src, rel).not.toMatch(/isNoMainPanelVisible\(/);
            expect(src, rel).toMatch(
                /shouldFallBackToTable\(useTM, useNM\.isTaskNotePaneVisible\)/
            );
        }
        const tp = read("features/tasks/components/contents/TaskPreview.tsx");
        expect(
            tp.match(/shouldFallBackToTable\(useTM, useNM\.isTaskNotePaneVisible\)/g)
        ).toHaveLength(2);
        const tb = read("features/tasks/components/contents/base/TaskTitleBlock.tsx");
        expect(
            tb.match(
                /shouldFallBackToTable\(useTM, useNM\.isTaskNotePaneVisible\)|shouldFallBackToTable\(\s*useTM,\s*useNM\.isTaskNotePaneVisible\s*\)/g
            )
        ).toHaveLength(3);
    });
    it("both note headers render the Focus button", () => {
        const chat = read("features/notes/chat-notes/components/ChatNoteHeader.tsx");
        expect(chat).toMatch(/<NoteFocusButton\b/);
        // The chat header toggles BOTH ways, for both hosts (chat page / task page).
        for (const fn of [
            "enterChatNoteFocus(useCM, useTM)",
            "exitChatNoteFocus(useCM)",
            "enterTaskNoteFocus(useTM)",
            "exitTaskNoteFocus(useTM)",
        ]) {
            expect(chat, fn).toContain(fn);
        }
        expect(read("features/notes/common/components/NoteHeaderActions.tsx")).toMatch(
            /<NoteFocusButton\b/
        );
        expect(read("features/notes/task-notes/components/TaskNoteMain.tsx")).toMatch(/focus=\{/);
    });
});

describe("locales", () => {
    it("every locale carries both strings, and they differ from each other", () => {
        for (const [name, m] of Object.entries({ en, ar, es, fr, hi, ja, zh })) {
            const h = (m as typeof en).notes.header;
            expect(h.focusNote, name).toBeTruthy();
            expect(h.exitFocusNote, name).toBeTruthy();
            expect(h.focusNote, name).not.toBe(h.exitFocusNote);
        }
    });
});
