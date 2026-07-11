/**
 * `useAgentMentionSources` against a real `HashMentionDataProvider` —
 * the adapter layer the AgentMentions suite mocks out.
 *
 * Focus: the "#" entity pool's coverage rules —
 *   - chats come from `allChats` (every chat type, not the editors'
 *     GM-only `chats` list), with the MDM name-join fallback;
 *   - projects are included, with the project code as subtitle;
 * and the project wire shape (`toWireMentions`).
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HashMentionDataProvider, type HashMentionData } from "../context/HashMentionDataContext";
import { toWireMentions } from "../features/agentQA/mentions/types";
import { useAgentMentionSources } from "../features/agentQA/mentions/useAgentMentionSources";
import type { AllChatProps } from "../types/chat";
import type { ProjectProps } from "../types/tasks";

const chat = (over: Partial<AllChatProps>): AllChatProps => ({ ...over }) as AllChatProps;

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

describe("toWireMentions project arm", () => {
    it("converts a project ref to the snake_case wire shape", () => {
        expect(
            toWireMentions([{ kind: "project", projectId: 7, label: "Website Redesign" }])
        ).toEqual([{ type: "project", project_id: 7, label: "Website Redesign" }]);
    });
});
