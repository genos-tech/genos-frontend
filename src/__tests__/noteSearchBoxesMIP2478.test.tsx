/**
 * MIP-2478: the "search task notes" and "search child notes" boxes kept their first list for as
 * long as they stayed mounted (`!open` read `window.open`), across closings and across tasks.
 */

import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACChatChildNotes } from "../features/notes/chat-notes/components/autocompletes/ACChatChildNotes";
import { ACTaskNotes } from "../features/notes/task-notes/components/autocompletes/ACTaskNotes";
import type { NoteManagementState } from "../hooks/notes/useNoteManagement";
import type { UserProps } from "../types/admin";

vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "token" }) }));

type Note = { noteId: number; title: string };
const loads = vi.hoisted(() => ({
    task: vi.fn<() => Promise<unknown>>(),
    chat: vi.fn<() => Promise<unknown>>(),
}));
vi.mock("../features/notes/task-notes/services/loadTaskNotes", () => ({
    loadTaskNotes: loads.task,
}));
vi.mock("../features/notes/chat-notes/services/loadChatSubNotes", () => ({
    loadChatSubNotes: loads.chat,
}));

const settle = () => act(async () => void (await Promise.resolve()));
const note = (noteId: number, title: string): Note => ({ noteId, title });
const titles = () => screen.queryAllByRole("option").map((option) => option.textContent);
const spinning = () => screen.queryByRole("progressbar") !== null;

beforeEach(() => {
    loads.task.mockReset();
    loads.chat.mockReset();
});

describe.each([
    {
        name: "task notes",
        Box: ACTaskNotes,
        load: loads.task,
        nm: (n: number) => ({ currentTaskNote: { projectId: n, taskId: n * 10 } }),
    },
    {
        name: "child notes",
        Box: ACChatChildNotes,
        load: loads.chat,
        nm: (n: number) => ({ currentChatNote: { noteId: n } }),
    },
])("the $name search box", ({ Box, load, nm }) => {
    const view = (open: boolean, n = 1) => (
        <CssVarsProvider>
            <Box
                myself={{ userId: "u1", teamId: "t1" } as UserProps}
                openSearchBox={open}
                setOpenSearchBox={() => {}}
                useNM={nm(n) as unknown as NoteManagementState}
            />
        </CssVarsProvider>
    );

    it("asks again each time it is opened", async () => {
        load.mockResolvedValueOnce([note(1, "Old title")]);
        load.mockResolvedValueOnce([note(1, "New title"), note(2, "Added")]);
        const { rerender } = render(view(true));
        await settle();
        expect(titles()).toEqual(["Old title"]);

        rerender(view(false));
        rerender(view(true));
        await settle();
        expect(titles()).toEqual(["New title", "Added"]);
    });

    it("never lists another target's notes", async () => {
        load.mockResolvedValueOnce([note(1, "From the first")]);
        load.mockReturnValueOnce(new Promise(() => {}));
        const { rerender } = render(view(true, 1));
        await settle();

        rerender(view(true, 2));
        await settle();
        expect(titles()).toEqual([]);
        expect(spinning()).toBe(true);
    });

    it("drops a late answer for the target no longer shown", async () => {
        let answerFirst: (notes: Note[]) => void = () => {};
        load.mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)));
        load.mockResolvedValueOnce([note(2, "From the second")]);
        const { rerender } = render(view(true, 1));
        rerender(view(true, 2));
        await settle();
        await act(async () => answerFirst([note(1, "From the first")]));
        expect(titles()).toEqual(["From the second"]);
    });

    it.each([
        ["an empty answer", []],
        ["a failed load", undefined],
    ])("stops spinning after %s", async (_, answer) => {
        load.mockResolvedValueOnce(answer);
        render(view(true));
        await settle();
        expect(spinning()).toBe(false);
        expect(load).toHaveBeenCalledTimes(1);
    });
});
