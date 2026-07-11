/**
 * `useAgentMentionSources` against a real `HashMentionDataProvider` —
 * the adapter layer the AgentMentions suite mocks out.
 *
 * Focus: the "#" entity pool's coverage rules —
 *   - chats come from `allChats` (every chat type, not the editors'
 *     GM-only `chats` list), with the MDM name-join fallback;
 *   - projects are included, with the project code as subtitle;
 *   - todos flatten from `todoGroups` (open always; completed only
 *     within the recency window);
 *   - mention groups join the `@` pool via `groupsOverride`;
 * and the new-kind wire shapes (`toWireMentions`).
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { toWireMentions } from "../features/agentQA/mentions/types";
import {
    todoCandidateItems,
    useAgentMentionSources,
} from "../features/agentQA/mentions/useAgentMentionSources";
import type { MentionGroup } from "../services/mentionGroupsApi";
import type { AllChatProps, TodoGroupProps, TodoItemProps } from "../types/chat";
import type { ProjectProps } from "../types/tasks";

const chat = (over: Partial<AllChatProps>): AllChatProps => ({ ...over }) as AllChatProps;

const todoItem = (itemId: number, title: string, isCompleted: boolean): TodoItemProps =>
    ({ itemId, title, isCompleted }) as TodoItemProps;

const todoGroup = (localDate: string, items: TodoItemProps[]): TodoGroupProps =>
    ({ groupId: 1, localDate, isCompleted: false, items }) as TodoGroupProps;

const DATA: HashMentionData = {
    tasks: [],
    notes: [],
    // The editors' GM-only list — the agent picker must NOT read this.
    chats: [chat({ chatType: 2, chatId: "gm-1", chatName: "backend-team" })],
    allChats: [
        chat({ chatType: 1, chatId: "dm-1", chatName: "Bob Martinez" }),
        chat({ chatType: 2, chatId: "gm-1", chatName: "backend-team" }),
        chat({ chatType: 3, chatId: "pm-1", chatName: "Website Redesign" }),
        // MDM: no server chatName → member-name join (sidebar convention).
        chat({
            chatType: 4,
            chatId: "mdm-1",
            chatName: "",
            mdmMembers: [
                { userId: "u-1", userName: "Alice" },
                { userId: "u-2", userName: "Carol" },
            ],
        }),
        // No derivable name → skipped.
        chat({ chatType: 4, chatId: "mdm-2", chatName: "" }),
    ],
    projects: [
        { projectId: 7, projectName: "Website Redesign", projectCode: "WRD" } as ProjectProps,
        { projectId: 8, projectName: "Q2 Roadmap", projectCode: null } as ProjectProps,
    ],
    todoGroups: [
        todoGroup("2099-01-01", [
            todoItem(55, "Ship hero handoff", false),
            todoItem(56, "Fresh completed chore", true),
        ]),
    ],
    myself: null,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <HashMentionDataProvider value={DATA}>{children}</HashMentionDataProvider>
);

describe("useAgentMentionSources # entity coverage", () => {
    it("serves every chat type from allChats, with the MDM name join", () => {
        const { result } = renderHook(() => useAgentMentionSources({ membersOverride: [] }), {
            wrapper,
        });
        const chats = result.current.entities.filter((c) => c.ref.kind === "chat");
        expect(chats.map((c) => c.key)).toEqual([
            "chat:1:dm-1",
            "chat:2:gm-1",
            "chat:3:pm-1",
            "chat:4:mdm-1",
        ]);
        expect(chats.map((c) => c.ref.label)).toEqual([
            "Bob Martinez",
            "backend-team",
            "Website Redesign",
            "Alice, Carol",
        ]);
    });

    it("includes projects with the project code as subtitle", () => {
        const { result } = renderHook(() => useAgentMentionSources({ membersOverride: [] }), {
            wrapper,
        });
        const projects = result.current.entities.filter((c) => c.ref.kind === "project");
        expect(projects).toEqual([
            {
                ref: { kind: "project", projectId: 7, label: "Website Redesign" },
                trigger: "#",
                key: "project:7",
                subtitle: "WRD",
            },
            {
                ref: { kind: "project", projectId: 8, label: "Q2 Roadmap" },
                trigger: "#",
                key: "project:8",
                subtitle: undefined,
            },
        ]);
    });
});

describe("useAgentMentionSources @ pool", () => {
    it("appends mention groups after members via groupsOverride", () => {
        const groups: MentionGroup[] = [
            { groupId: 3, groupName: "design-crew", memberCount: 2 } as MentionGroup,
        ];
        const { result } = renderHook(
            () => useAgentMentionSources({ membersOverride: [], groupsOverride: groups }),
            { wrapper }
        );
        expect(result.current.members).toEqual([
            {
                ref: { kind: "group", groupId: 3, label: "design-crew" },
                trigger: "@",
                key: "group:3",
                subtitle: undefined,
            },
        ]);
    });
});

describe("todoCandidateItems", () => {
    const now = new Date("2026-07-11T00:00:00Z");
    it("always offers open todos, and completed ones only within the window", () => {
        const groups = [
            todoGroup("2026-07-10", [
                todoItem(1, "Open recent", false),
                todoItem(2, "Done recent", true),
            ]),
            todoGroup("2026-01-01", [
                todoItem(3, "Open ancient", false),
                todoItem(4, "Done ancient", true),
                todoItem(5, "", false),
            ]),
        ];
        expect(todoCandidateItems(groups, now).map((t) => t.itemId)).toEqual([1, 2, 3]);
    });
});

describe("useAgentMentionSources todo rows", () => {
    it("serves todo candidates in the # pool", () => {
        const { result } = renderHook(() => useAgentMentionSources({ membersOverride: [] }), {
            wrapper,
        });
        const todos = result.current.entities.filter((c) => c.ref.kind === "todo");
        expect(todos.map((c) => c.key)).toEqual(["todo:55", "todo:56"]);
        expect(todos[0].ref.label).toBe("Ship hero handoff");
    });
});

describe("toWireMentions new-kind arms", () => {
    it("converts project / group / todo refs to the snake_case wire shape", () => {
        expect(
            toWireMentions([
                { kind: "project", projectId: 7, label: "Website Redesign" },
                { kind: "group", groupId: 3, label: "design-crew" },
                { kind: "todo", itemId: 55, label: "Ship hero handoff" },
            ])
        ).toEqual([
            { type: "project", project_id: 7, label: "Website Redesign" },
            { type: "group", group_id: 3, label: "design-crew" },
            { type: "todo", item_id: 55, label: "Ship hero handoff" },
        ]);
    });
});
