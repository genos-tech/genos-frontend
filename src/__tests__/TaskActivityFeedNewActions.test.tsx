/**
 * MIP-700: the backend now records start-date, tag and project changes
 * (including those carried along by a milestone / project move). Before
 * this, `start_date_changed` / `project_changed` fell through to the raw
 * action name with a bare "#id" chip, and a tag row stringified the
 * stored `[{ tagName }]` JSON.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskActivityFeed } from "../features/tasks/components/contents/base/sub/TaskActivityFeed";
import type { TaskActivityProps } from "../types/tasks";

vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span />,
}));

const row = (overrides: Partial<TaskActivityProps>): TaskActivityProps => ({
    activityId: 1,
    actionType: "status_changed",
    fieldName: "status",
    oldValue: null,
    newValue: null,
    metadata: {},
    actor: { userId: "u1", userName: "Ken", avatarImgPath: null },
    tsCreatedAt: new Date().toISOString(),
    ...overrides,
});

const renderFeed = (activities: TaskActivityProps[]) =>
    render(
        <CssVarsProvider>
            <TaskActivityFeed
                activities={activities}
                allTasks={[]}
                isLoading={false}
                myself={{ userId: "u1" } as never}
                setMyself={() => {}}
                socket={null}
                useCM={{} as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useUISM={{} as never}
            />
        </CssVarsProvider>
    );

describe("TaskActivityFeed — MIP-700 action types", () => {
    it("labels a project move with the project names, not ids", () => {
        renderFeed([
            row({
                actionType: "project_changed",
                fieldName: "project_id",
                oldValue: 3,
                newValue: 7,
                metadata: { oldLabel: "Source", newLabel: "Destination", cascade: "project_move" },
            }),
        ]);
        expect(screen.getByText("changed project from")).toBeTruthy();
        expect(screen.getByText("Source")).toBeTruthy();
        expect(screen.getByText("Destination")).toBeTruthy();
        expect(screen.queryByText("#3")).toBeNull();
        expect(screen.queryByText("project changed")).toBeNull();
    });

    it("has a verb for a start-date change", () => {
        renderFeed([
            row({
                actionType: "start_date_changed",
                fieldName: "start_date",
                oldValue: null,
                newValue: "2026-11-02",
            }),
        ]);
        expect(screen.getByText("changed start date from")).toBeTruthy();
        expect(screen.getByText("2026-11-02")).toBeTruthy();
    });

    it("shows tag names on both sides, with None for a cleared list", () => {
        renderFeed([
            row({
                actionType: "tags_changed",
                fieldName: "tags",
                oldValue: [{ tagName: "api" }, { tagName: "urgent" }],
                newValue: null,
            }),
        ]);
        expect(screen.getByText("api, urgent")).toBeTruthy();
        expect(screen.getByText("None")).toBeTruthy();
        expect(screen.queryByText(/tagName/)).toBeNull();
    });
});
