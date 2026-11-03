/**
 * The `#` menu's backing data is memoized on its inputs.
 *
 * Every input has to be in that dependency list. Team Notes was read by the
 * memo but missing from the list, so a refresh that changed ONLY the team
 * notes kept handing out the old value until something else the menu reads
 * happened to change. That became easy to hit once the refresh setters keep
 * the previous array when nothing changed (MIP-960): an idle refresh no
 * longer disturbs the other inputs.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useHashMentionData, UseHashMentionDataInputs } from "../context/useHashMentionData";

const noop = () => {};

const base = (): UseHashMentionDataInputs => ({
    allChats: [],
    chatNoteMeta: [],
    myNoteMeta: [],
    myself: null,
    projects: [],
    refresh: noop,
    sharedNoteMeta: [],
    tasks: [],
    taskNoteMeta: [],
    teamNoteMeta: [],
    teamTasks: [],
    todoGroups: [],
});

const row = <T extends object>(extra: T) => extra as never;

describe("useHashMentionData", () => {
    it("keeps the same value while no input changed", () => {
        const inputs = base();
        const { result, rerender } = renderHook(
            (p: UseHashMentionDataInputs) => useHashMentionData(p),
            {
                initialProps: inputs,
            }
        );
        const first = result.current;
        rerender({ ...inputs });
        expect(result.current).toBe(first);
    });

    it("picks up a change to Team Notes alone", () => {
        const inputs = base();
        const { result, rerender } = renderHook(
            (p: UseHashMentionDataInputs) => useHashMentionData(p),
            {
                initialProps: inputs,
            }
        );
        const first = result.current;
        expect(first.notes).toHaveLength(0);

        rerender({ ...inputs, teamNoteMeta: [row({ noteId: 1, title: "Roadmap" })] });

        expect(result.current).not.toBe(first);
        expect(result.current.notes).toHaveLength(1);
        expect(result.current.notes[0]).toMatchObject({ kind: "team", title: "Roadmap" });
    });

    // Each input, changed on its own, must produce a new value.
    const changes: Array<[string, Partial<UseHashMentionDataInputs>]> = [
        ["tasks", { tasks: [row({ id: "1" })] }],
        ["teamTasks", { teamTasks: [row({ id: "2" })] }],
        ["myNoteMeta", { myNoteMeta: [row({ noteId: 1 })] }],
        ["taskNoteMeta", { taskNoteMeta: [row({ noteId: 2 })] }],
        ["chatNoteMeta", { chatNoteMeta: [row({ noteId: 3 })] }],
        ["sharedNoteMeta", { sharedNoteMeta: [row({ noteId: 4 })] }],
        ["teamNoteMeta", { teamNoteMeta: [row({ noteId: 5 })] }],
        ["allChats", { allChats: [row({ chatId: "c", chatType: 2 })] }],
        ["projects", { projects: [row({ projectId: 1 })] }],
        ["todoGroups", { todoGroups: [row({ groupId: 1 })] }],
        ["myself", { myself: row({ userId: "u" }) }],
        ["refresh", { refresh: () => {} }],
    ];
    it.each(changes)("gives a new value when %s changes", (_name, patch) => {
        const inputs = base();
        const { result, rerender } = renderHook(
            (p: UseHashMentionDataInputs) => useHashMentionData(p),
            {
                initialProps: inputs,
            }
        );
        const first = result.current;
        rerender({ ...inputs, ...patch });
        expect(result.current).not.toBe(first);
    });

    it("lists only group chats under `chats`, and every chat under `allChats`", () => {
        const dm = row({ chatId: "dm", chatType: 1 });
        const gm = row({ chatId: "gm", chatType: 2 });
        const { result } = renderHook(() => useHashMentionData({ ...base(), allChats: [dm, gm] }));
        expect(result.current.chats).toEqual([gm]);
        expect(result.current.allChats).toEqual([dm, gm]);
    });

    it("tags each note with its kind, in the order my, task, chat, shared, team", () => {
        const { result } = renderHook(() =>
            useHashMentionData({
                ...base(),
                chatNoteMeta: [row({ noteId: 3 })],
                myNoteMeta: [row({ noteId: 1 })],
                sharedNoteMeta: [row({ noteId: 4 })],
                taskNoteMeta: [row({ noteId: 2 })],
                teamNoteMeta: [row({ noteId: 5 })],
            })
        );
        expect(result.current.notes.map((n) => n.kind)).toEqual([
            "my",
            "task",
            "chat",
            "shared",
            "team",
        ]);
    });
});
