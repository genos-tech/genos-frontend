/**
 * MIP-834: `remove_task_delivery` writes a `pr_unlinked` history row. Without
 * a case for it the feed fell through to the raw action name ("pr unlinked")
 * with no hint of which PR went. The row's `metadata` is a snapshot, because
 * the delivery it describes is deleted.
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
    actionType: "pr_unlinked",
    fieldName: "delivery",
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

describe("TaskActivityFeed — pr_unlinked", () => {
    it("says who removed which PR, linked to it", () => {
        renderFeed([
            row({
                metadata: {
                    pr_url: "https://github.com/genos-tech/genos-frontend/pull/519",
                    repo: "genos-tech/genos-frontend",
                    branch: "MIP-741",
                },
            }),
        ]);
        expect(screen.getByText("Ken")).toBeTruthy();
        expect(screen.getByText("removed the link to")).toBeTruthy();
        const ref = screen.getByText("genos-tech/genos-frontend#519");
        expect(ref.getAttribute("href")).toBe(
            "https://github.com/genos-tech/genos-frontend/pull/519"
        );
        expect(screen.queryByText("pr unlinked")).toBeNull();
    });

    it("names the repo and branch for a branch-only link", () => {
        renderFeed([
            row({
                metadata: { pr_url: null, repo: "genos-tech/genos-api", branch: "feat/x" },
            }),
        ]);
        expect(screen.getByText("genos-tech/genos-api feat/x")).toBeTruthy();
    });

    it("falls back to a generic label when the snapshot has nothing", () => {
        renderFeed([row({ metadata: {} })]);
        expect(screen.getByText("a pull request")).toBeTruthy();
    });
});
