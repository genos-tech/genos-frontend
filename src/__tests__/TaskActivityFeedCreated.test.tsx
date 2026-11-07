/**
 * MIP-947: every task's Activity tab starts with a "<user> created this" row.
 * The API stores that row's value as an object --
 * `{"title": ..., "status": ..., "is_milestone": ...}` (captured from the
 * local API for a task made through the create form) -- and the feed printed
 * it as raw JSON. The row must read as a sentence with ONE chip, the starting
 * status; the title is the task's own title and is already on screen.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TaskActivityFeed } from "../features/tasks/components/contents/base/sub/TaskActivityFeed";
import type { TaskActivityProps } from "../types/tasks";

vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span />,
}));

const TITLE = "Deleting a project's newest sprint makes its sprint list return 500";

const row = (overrides: Partial<TaskActivityProps>): TaskActivityProps => ({
    activityId: 1,
    actionType: "created",
    fieldName: null,
    oldValue: null,
    newValue: null,
    metadata: { via: { kind: "app" } },
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

describe("TaskActivityFeed -- the 'created' row (MIP-947)", () => {
    it("shows the starting status as one chip, not the raw JSON payload", () => {
        renderFeed([row({ newValue: { title: TITLE, status: "Open", is_milestone: false } })]);
        expect(screen.getByText("created this")).toBeTruthy();
        expect(screen.getAllByText("Open")).toHaveLength(1);
        // Neither the JSON nor any piece of it reaches the screen. The title
        // check is what catches a fallback that merely "prettifies" the
        // payload by joining its values.
        expect(screen.queryByText(/\{"title"/)).toBeNull();
        expect(screen.queryByText(/is_milestone/)).toBeNull();
        expect(screen.queryByText(/Deleting a project/)).toBeNull();
        expect(screen.queryByText(/false/)).toBeNull();
        expect(screen.queryByText("Milestone")).toBeNull();
    });

    it("says so when the created row is a milestone", () => {
        renderFeed([row({ newValue: { title: "Q4 launch", status: "WIP", is_milestone: true } })]);
        expect(screen.getByText("created this")).toBeTruthy();
        expect(screen.getByText("Milestone")).toBeTruthy();
        expect(screen.getAllByText("WIP")).toHaveLength(1);
        expect(screen.queryByText(/Q4 launch/)).toBeNull();
        expect(screen.queryByText(/\{"title"/)).toBeNull();
    });

    it("draws the starting status like every other status: the shared label, in its tone", () => {
        // The created row has no field_name, so the value must be told it is a
        // status to get the status treatment (WIP is the warning tone, MIP-1122).
        renderFeed([row({ newValue: { title: TITLE, status: "WIP", is_milestone: false } })]);
        const icon = screen
            .getByText("WIP")
            .parentElement!.querySelector('span[aria-hidden="true"]') as HTMLElement;
        expect(icon).toBeTruthy();
        expect(icon.style.color).toBe("var(--g-warning-text)");
    });

    it("renders a created row with no value as just the sentence", () => {
        renderFeed([row({ newValue: null })]);
        expect(screen.getByText("Ken")).toBeTruthy();
        expect(screen.getByText("created this")).toBeTruthy();
        expect(screen.queryByText("None")).toBeNull();
    });

    it("shows no chip, and not 'None', when the object carries no status", () => {
        renderFeed([row({ newValue: { title: TITLE, is_milestone: false } })]);
        expect(screen.getByText("created this")).toBeTruthy();
        expect(screen.queryByText("None")).toBeNull();
        expect(screen.queryByText(/Deleting a project/)).toBeNull();
        expect(screen.queryByText(/\{"title"/)).toBeNull();
    });

    it("keeps rendering an old row whose value is a plain string", () => {
        renderFeed([row({ newValue: "Fix the login bug" })]);
        expect(screen.getByText("created this")).toBeTruthy();
        expect(screen.getByText("Fix the login bug")).toBeTruthy();
    });
});

describe("TaskActivityFeed -- an object value never reaches the screen as JSON (MIP-947)", () => {
    it("shows the readable values of an unknown object", () => {
        renderFeed([
            row({
                actionType: "custom_field_changed",
                fieldName: "something_new",
                newValue: { name: "Alice", count: 4, flag: true, empty: "" },
            }),
        ]);
        expect(screen.getByText("Alice, 4")).toBeTruthy();
        expect(screen.queryByText(/\{"name"/)).toBeNull();
        expect(screen.queryByText(/true/)).toBeNull();
    });

    it("flattens a list of objects and a nested object instead of printing them", () => {
        renderFeed([
            row({
                activityId: 1,
                actionType: "title_changed",
                fieldName: "something_new",
                oldValue: [{ label: "api" }, { label: "urgent" }],
                newValue: { outer: { inner: "deep" }, other: "x" },
            }),
        ]);
        expect(screen.getByText("api, urgent")).toBeTruthy();
        expect(screen.getByText("deep, x")).toBeTruthy();
        expect(screen.queryByText(/\[object Object\]/)).toBeNull();
        expect(screen.queryByText(/[{}[\]]/)).toBeNull();
    });

    it("falls back to None when an object holds nothing readable", () => {
        renderFeed([
            row({
                actionType: "title_changed",
                fieldName: "something_new",
                oldValue: { a: true, b: null },
                newValue: [],
            }),
        ]);
        expect(screen.getAllByText("None")).toHaveLength(2);
        expect(screen.queryByText(/[{}[\]]/)).toBeNull();
    });
});
