/**
 * MIP-1389: the surfaces that list or bucket tasks read a task under a Closed or
 * Deleted ancestor as Closed or Deleted, whatever its own row says.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { MobileTaskList } from "../features/tasks/MobileTaskList";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

const task = (over: Partial<TaskTableProps>): TaskTableProps =>
    ({
        id: "1",
        title: "Row",
        status: "Open",
        tags: [],
        projectId: 1,
        parentTaskId: null,
        isMilestone: false,
        ...over,
    }) as unknown as TaskTableProps;

const withContext = (node: React.ReactNode) => (
    <AvatarContextProvider
        value={{
            myself: { userId: "me", userName: "Me" } as unknown as UserProps,
            setMyself: () => {},
            teamMemberProfiles: {},
            setTeamMemberProfiles: () => {},
            socket: null,
            useCM: {} as never,
            useUISM: {} as never,
        }}
    >
        <CssVarsProvider>{node}</CssVarsProvider>
    </AvatarContextProvider>
);

describe("the phone task list", () => {
    it("hides a task whose milestone is Closed or Deleted, whatever its own status", () => {
        render(
            withContext(
                <MobileTaskList
                    usePM={{ currentProject: { projectId: 1 } } as never}
                    useTM={
                        {
                            allTasks: [
                                task({ id: "10", title: "Live", milestoneId: 1 }),
                                task({
                                    id: "70",
                                    title: "Closed milestone",
                                    status: "Closed",
                                    isMilestone: true,
                                    milestoneId: 7,
                                }),
                                task({ id: "11", title: "In the closed one", milestoneId: 7 }),
                                task({
                                    id: "80",
                                    title: "Deleted milestone",
                                    status: "Deleted",
                                    isMilestone: true,
                                    milestoneId: 8,
                                }),
                                task({ id: "12", title: "In the deleted one", milestoneId: 8 }),
                                task({
                                    id: "71",
                                    title: "Open milestone",
                                    isMilestone: true,
                                    milestoneId: 1,
                                }),
                            ],
                            setCurrentPreviewTaskId: vi.fn(),
                            setIsTaskPreviewVisible: vi.fn(),
                        } as never
                    }
                />
            )
        );
        expect(screen.getByText("Live")).toBeTruthy();
        expect(screen.getByText("Open milestone")).toBeTruthy();
        for (const hidden of [
            "Closed milestone",
            "In the closed one",
            "Deleted milestone",
            "In the deleted one",
        ]) {
            expect(screen.queryByText(hidden)).toBeNull();
        }
    });
});
