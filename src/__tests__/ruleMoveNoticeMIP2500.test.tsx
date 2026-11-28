/**
 * MIP-2500: a project rule's move. The old chat gets one line stored with ids only; who may open
 * the task and the new project reads their names, everyone else "a task" / "another project".
 * The task's history says "moved by rule R" / "rule not applied".
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HashMentionDataProvider } from "../context/HashMentionDataContext";
import { v3MessagesToLegacy } from "../features/chat/adapters/v3ToLegacy";
import { RuleMoveNoticeRow } from "../features/chat/components/bubbles/RuleMoveNoticeRow";
import { clearRuleMoveRefs } from "../features/chat/hooks/useRuleMoveRefs";
import { TaskActivityFeed } from "../features/tasks/components/contents/base/sub/TaskActivityFeed";
import type { Message } from "../types/channel";
import type { TaskActivityProps } from "../types/tasks";

const loadSpecificTask = vi.hoisted(() => vi.fn());
vi.mock("../features/tasks/services/loadSpecificTask", () => ({ loadSpecificTask }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "token" }) }));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span />,
}));

const META = {
    systemNotice: "task_moved_by_rule",
    movedTaskId: 41,
    destinationProjectId: 7,
    ruleName: "Handover {project}",
};

const message = (overrides: Partial<Message>): Message =>
    ({
        id: "m1",
        channelKind: 3,
        sender: null,
        seq: 5,
        body: [],
        bodyText: "",
        isThreadReply: false,
        replyCount: 0,
        reactions: [],
        mentions: [],
        attachments: [],
        metadata: META,
        taskId: null,
        displayId: null,
        taskStatus: null,
        deletedAt: null,
        tsSent: "2026-11-28T00:00:00Z",
        tsUpdated: "2026-11-28T00:00:00Z",
        ...overrides,
    }) as Message;

const adapt = (m: Message) => v3MessagesToLegacy({ messages: [m], channelId: "c", chatType: 3 });

describe("the old project chat's line", () => {
    it("is kept in a project chat although it has no task card", () => {
        const [row] = adapt(message({}));
        expect(row.ruleMove).toEqual({ taskId: 41, projectId: 7, ruleName: "Handover {project}" });
    });

    it("cannot be drawn by a member's own message", () => {
        expect(adapt(message({ sender: { userId: "u2" } as never }))).toEqual([]);
    });

    const renderRow = (projects: { projectId: number; isJoined: boolean }[]) =>
        render(
            <CssVarsProvider>
                <HashMentionDataProvider
                    value={{
                        tasks: [],
                        notes: [],
                        chats: [],
                        allChats: [],
                        todoGroups: [],
                        refresh: () => {},
                        myself: { userId: "u1", teamId: "t1" } as never,
                        projects: projects.map(
                            (p) => ({ ...p, projectName: "Zanzibar" }) as never
                        ),
                    }}
                >
                    <RuleMoveNoticeRow
                        notice={{ taskId: 41, projectId: 7, ruleName: "Handover {project}" }}
                    />
                </HashMentionDataProvider>
            </CssVarsProvider>
        );
    const text = () => document.querySelector("[data-rule-move-notice]")!.textContent;

    beforeEach(() => {
        clearRuleMoveRefs();
        loadSpecificTask.mockReset();
    });

    it("names the task and the project for a viewer who can open them", async () => {
        loadSpecificTask.mockResolvedValue([{ displayId: "ZZ-3", title: "Plan" }]);
        renderRow([{ projectId: 7, isJoined: true }]);
        await waitFor(() =>
            expect(text()).toBe("Rule “Handover {project}” moved #ZZ-3 · Plan to #Zanzibar.")
        );
        // From the server, never the copy cached while the task was in this project.
        expect(loadSpecificTask).toHaveBeenCalledWith(expect.anything(), 7, 41, "token", {
            forceRefresh: true,
        });
    });

    it("names neither for a viewer who cannot", async () => {
        loadSpecificTask.mockResolvedValue([]);
        // Listed (a private project of the team) but not joined.
        renderRow([{ projectId: 7, isJoined: false }]);
        await waitFor(() => expect(loadSpecificTask).toHaveBeenCalled());
        expect(text()).toBe("Rule “Handover {project}” moved a task to another project.");
        expect(screen.queryByText(/Zanzibar/)).toBeNull();
    });
});

const row = (overrides: Partial<TaskActivityProps>): TaskActivityProps => ({
    activityId: 1,
    actionType: "automation_applied",
    fieldName: "automation",
    oldValue: null,
    newValue: null,
    metadata: {},
    actor: { userId: "u1", userName: "Ken", avatarImgPath: null },
    tsCreatedAt: new Date().toISOString(),
    ...overrides,
});

describe("history rows a rule writes", () => {
    const sentence = (activity: TaskActivityProps) => {
        const view = render(
            <CssVarsProvider>
                <TaskActivityFeed
                    activities={[activity]}
                    allTasks={[]}
                    isLoading={false}
                    loadFailed={false}
                    myself={{ userId: "u1" } as never}
                    setMyself={() => {}}
                    socket={null}
                    useCM={{} as never}
                    useTEM={{ teamMemberProfiles: {} } as never}
                    useUISM={{} as never}
                    onRetry={() => {}}
                />
            </CssVarsProvider>
        );
        const found = view.container.querySelector("[data-automation-row] p")!.textContent;
        view.unmount();
        return found;
    };

    it("says what the rule did", () => {
        expect(sentence(row({ metadata: { ruleName: "R", toProjectId: 7 } }))).toBe(
            "Moved by rule “R”"
        );
        expect(sentence(row({ metadata: { ruleName: "R", toProjectId: null } }))).toBe(
            "Changed by rule “R”"
        );
    });

    it("says why it was not applied, in words", () => {
        const refused = (reason: string) =>
            sentence(
                row({ actionType: "automation_refused", metadata: { ruleName: "R", reason } })
            );
        for (const reason of [
            "destination",
            "owner",
            "plan",
            "nested",
            "rate_limited",
            "error",
            "bad_status",
            "assignee_not_allowed",
        ]) {
            expect(refused(reason)).toMatch(/^Rule “R” not applied: .+/);
            expect(refused(reason)).not.toContain("_");
        }
        expect(refused("something_new")).toBe("Rule “R” not applied");
    });
});
