/**
 * MIP-739 / MIP-788: a task is found and mentioned by its display id.
 *
 *   - "MIP-739", "mip739", "739" match the id; a whole id that no listed
 *     (open) task has is looked up, so a closed task is found too.
 *   - A task picked by its id goes in compact: a `#MIP-739` chip in the
 *     editors, the `#MIP-739` token in the agent inputs.
 *   - Spotlight rows name a task by its id.
 */

import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    HashMentionMenuItems,
    lookedUpTaskItem,
    rememberHashQuery,
} from "../components/editors/HashMention";
import { HashMentionData } from "../context/HashMentionDataContext";
import type { AgentMentionCandidate } from "../features/agentQA/mentions/types";
import { useAgentMentionDraft } from "../features/agentQA/mentions/useAgentMentionDraft";
import { entitySubtitle, rowSubtitle } from "../features/spotlight/SpotlightResultItem";
import type { SpotlightResult } from "../features/spotlight/types";
import { filterTaskSearchOptions } from "../features/tasks/components/sidebar/SearchBox";
import {
    displayIdEquals,
    displayIdMatches,
    fullDisplayIdIn,
    hashTaskLabel,
    pickedByDisplayId,
} from "../features/tasks/utils/taskDisplayId";
import { getMessages } from "../i18n";
import { SearchTeamTasksResponse } from "../types/tasks";

describe("display-id matching", () => {
    it.each(["MIP-739", "mip-739", "#MIP-739", "mip739", "739", "MIP-73", " mip "])(
        "%s matches MIP-739",
        (q) => expect(displayIdMatches(q, "MIP-739")).toBe(true)
    );

    it.each(["GEN-739", "MIP-7390", "", "#"])("%s does not match MIP-739", (q) =>
        expect(displayIdMatches(q, "MIP-739")).toBe(false)
    );

    it("an exact id ignores case, # and the hyphen, but not a longer number", () => {
        expect(displayIdEquals("#mip739", "MIP-739")).toBe(true);
        expect(displayIdEquals("MIP-73", "MIP-739")).toBe(false);
    });

    it("finds a whole id in a query", () => {
        expect(fullDisplayIdIn(" #mip-12 ")).toBe("mip-12");
        for (const q of ["MIP", "MIP-", "12", "fix MIP-12", "M-12", "MIP-12a"]) {
            expect(fullDisplayIdIn(q)).toBeNull();
        }
    });

    it("picked by id means the id matched and the title didn't", () => {
        expect(pickedByDisplayId("MIP-7", "MIP-739", "Search by id")).toBe(true);
        expect(pickedByDisplayId("search", "MIP-739", "Search by id")).toBe(false);
        // Both match: the title wins, the chip stays full.
        expect(pickedByDisplayId("mip", "MIP-739", "Mip refactor")).toBe(false);
    });

    it("a compact chip shows its id alone", () => {
        const chip = { taskId: "5", displayId: "MIP-739", title: "Search by id" };
        expect(hashTaskLabel(chip)).toBe("MIP-739 · Search by id");
        expect(hashTaskLabel({ ...chip, labelMode: "id" })).toBe("MIP-739");
        expect(hashTaskLabel({ taskId: "5", labelMode: "id" })).toBe("5");
    });
});

const row = (over: Partial<SearchTeamTasksResponse>): SearchTeamTasksResponse =>
    ({
        projectId: 1,
        projectName: "Genos",
        taskId: 1,
        displayId: "MIP-1",
        title: "Task",
        isMilestone: false,
        status: { code: 0, status: "Open", color: "", textColor: "" },
        ...over,
    }) as unknown as SearchTeamTasksResponse;

describe("task search bar", () => {
    const options = [
        row({ taskId: 1, displayId: "MIP-739", title: "Search by id" }),
        row({ taskId: 2, displayId: "MIP-12", title: "Note folders" }),
    ];

    it("matches by title or by id", () => {
        expect(filterTaskSearchOptions(options, "folders").map((o) => o.taskId)).toEqual([2]);
        expect(filterTaskSearchOptions(options, "mip-739").map((o) => o.taskId)).toEqual([1]);
        expect(filterTaskSearchOptions(options, "12").map((o) => o.taskId)).toEqual([2]);
        expect(filterTaskSearchOptions(options, "")).toEqual(options);
    });
});

const dataWith = (over: Partial<HashMentionData>): HashMentionData => ({
    tasks: [],
    teamTasks: [],
    notes: [],
    chats: [],
    allChats: [],
    projects: [],
    todoGroups: [],
    myself: null,
    refresh: () => {},
    ...over,
});

describe("editor # menu", () => {
    const task = row({ taskId: 9, projectId: 2, displayId: "MKT-9", title: "Launch post" });

    it("matches an id typed without its hyphen", () => {
        const [item] = HashMentionMenuItems({}, dataWith({ teamTasks: [task] }));
        expect(item.aliases).toContain("MKT9");
    });

    it.each([
        ["MKT-9", "id"],
        ["mkt9", "id"],
        ["launch", ""],
    ])("picked after typing %s, the chip's labelMode is %j", (query, labelMode) => {
        const editor = { insertInlineContent: vi.fn() };
        const [item] = HashMentionMenuItems(editor, dataWith({ teamTasks: [task] }));
        rememberHashQuery(editor, query);
        item.onItemClick();
        expect(editor.insertInlineContent.mock.calls[0][0][0].props.labelMode).toBe(labelMode);
    });

    it("a looked-up (closed) task becomes a row like any other", () => {
        const editor = { insertInlineContent: vi.fn() };
        const item = lookedUpTaskItem(editor, task, []);
        expect(item.title).toBe("MKT-9");
        item.onItemClick();
        expect(editor.insertInlineContent.mock.calls[0][0][0]).toMatchObject({
            type: "hashTask",
            props: { taskId: "9", displayId: "MKT-9", title: "Launch post" },
        });
    });
});

const taskCandidate = (taskId: number, title: string, displayId: string): AgentMentionCandidate =>
    ({
        ref: { kind: "task", taskId, label: title },
        trigger: "#",
        key: `task:${taskId}`,
        subtitle: displayId,
    }) as AgentMentionCandidate;

const ENTITIES = [
    taskCandidate(1, "Search by id", "MIP-739"),
    taskCandidate(2, "Note folders", "MIP-747"),
];

function useHarness(lookupTask?: (id: string) => Promise<AgentMentionCandidate | null>) {
    const [value, setValue] = useState("");
    const draft = useAgentMentionDraft({
        value,
        onChange: setValue,
        members: [],
        entities: ENTITIES,
        lookupTask,
    });
    return { value, setValue, draft };
}

const type = (result: { current: ReturnType<typeof useHarness> }, text: string) => {
    act(() => result.current.setValue(text));
    act(() => result.current.draft.setCaret(text.length));
};

describe("agent # picker", () => {
    beforeEach(() => vi.useRealTimers());

    it("finds a task by its id and inserts the id", () => {
        const { result } = renderHook(() => useHarness());
        type(result, "see #mip-739");
        expect(result.current.draft.suggestions.map((s) => s.key)).toEqual(["task:1"]);
        act(() => {
            result.current.draft.selectHighlighted();
        });
        expect(result.current.value).toBe("see #MIP-739 ");
        let sent: unknown[] = [];
        act(() => {
            sent = result.current.draft.consumeMentions("see #MIP-739 ");
        });
        expect(sent).toEqual([{ kind: "task", taskId: 1, label: "MIP-739" }]);
    });

    it("a task picked by its title still inserts the title", () => {
        const { result } = renderHook(() => useHarness());
        type(result, "#note fo");
        act(() => {
            result.current.draft.selectHighlighted();
        });
        expect(result.current.value).toBe("#Note folders ");
    });

    it("a hand-typed #MIP-747 resolves without a pick", () => {
        const { result } = renderHook(() => useHarness());
        let sent: unknown[] = [];
        act(() => {
            sent = result.current.draft.consumeMentions("about #MIP-747 please");
        });
        expect(sent).toEqual([{ kind: "task", taskId: 2, label: "MIP-747" }]);
    });

    it("looks up a whole id the pool doesn't hold (a closed task)", async () => {
        vi.useFakeTimers();
        const closed = taskCandidate(7, "Old work", "MIP-7");
        const lookupTask = vi.fn(async () => closed);
        const { result } = renderHook(() => useHarness(lookupTask));
        type(result, "#MIP-7");
        // Prefix matches first; the exact id arrives with the lookup.
        expect(result.current.draft.suggestions.map((s) => s.key)).toEqual(["task:1", "task:2"]);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });
        expect(lookupTask).toHaveBeenCalledWith("MIP-7");
        expect(result.current.draft.suggestions.map((s) => s.key)).toEqual([
            "task:7",
            "task:1",
            "task:2",
        ]);
    });

    it("does not look up an id the pool already has", async () => {
        vi.useFakeTimers();
        const lookupTask = vi.fn(async () => null);
        const { result } = renderHook(() => useHarness(lookupTask));
        type(result, "#MIP-739");
        await act(async () => {
            await vi.advanceTimersByTimeAsync(300);
        });
        expect(lookupTask).not.toHaveBeenCalled();
    });
});

describe("Spotlight rows", () => {
    const ts = getMessages().spotlight;
    const r = (over: Partial<SpotlightResult>) =>
        ({ entity_type: "task", task_display_id: "MIP-739", ...over }) as SpotlightResult;

    it("name a task and a milestone by their id", () => {
        expect(rowSubtitle(r({}), ts)).toBe(`${ts.entitySubtitle.task} · MIP-739`);
        expect(rowSubtitle(r({ entity_type: "milestone" }), ts)).toBe(
            `${ts.entitySubtitle.milestone} · MIP-739`
        );
        expect(rowSubtitle(r({ task_display_id: null }), ts)).toBe(ts.entitySubtitle.task);
    });

    it("leave the chip prefix alone", () => {
        expect(entitySubtitle(r({}), ts)).toBe(ts.entitySubtitle.task);
    });
});
