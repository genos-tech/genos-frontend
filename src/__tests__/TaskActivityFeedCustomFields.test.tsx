/**
 * MIP-703: the backend now records a `custom_field_changed` row per
 * changed custom field, with the field's name and the readable values
 * (tag → option labels, member → username) snapshotted into metadata.
 * The raw values are option / user ids, so the chips must read the
 * labels, and the verb must name the field.
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
    actionType: "custom_field_changed",
    fieldName: "custom_field",
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

describe("TaskActivityFeed — custom-field changes", () => {
    it("names the field and shows both text values", () => {
        renderFeed([
            row({
                oldValue: "Acme",
                newValue: "Globex",
                metadata: {
                    fieldId: 4,
                    fieldName: "Customer",
                    fieldType: "text",
                    oldLabel: "Acme",
                    newLabel: "Globex",
                },
            }),
        ]);
        expect(screen.getByText("changed Customer from")).toBeTruthy();
        expect(screen.getByText("Acme")).toBeTruthy();
        expect(screen.getByText("Globex")).toBeTruthy();
        expect(screen.queryByText("custom field changed")).toBeNull();
    });

    it("shows tag option labels, not option ids, with None for an unset side", () => {
        renderFeed([
            row({
                oldValue: null,
                newValue: ["opt-api", "opt-ui"],
                metadata: {
                    fieldName: "Area",
                    fieldType: "tag",
                    oldLabel: null,
                    newLabel: ["API", "UI"],
                },
            }),
        ]);
        expect(screen.getByText("changed Area from")).toBeTruthy();
        expect(screen.getByText("None")).toBeTruthy();
        expect(screen.getByText("API, UI")).toBeTruthy();
        expect(screen.queryByText(/opt-/)).toBeNull();
    });

    it("shows a member field's username, not the user id", () => {
        renderFeed([
            row({
                oldValue: "42",
                newValue: null,
                metadata: {
                    fieldName: "QA owner",
                    fieldType: "member",
                    oldLabel: "alice",
                    newLabel: null,
                },
            }),
        ]);
        expect(screen.getByText("alice")).toBeTruthy();
        expect(screen.getByText("None")).toBeTruthy();
        expect(screen.queryByText("42")).toBeNull();
    });

    it("falls back to the raw value and a generic name when metadata is missing", () => {
        renderFeed([row({ oldValue: "x", newValue: "y", metadata: null })]);
        expect(screen.getByText("changed a custom field from")).toBeTruthy();
        expect(screen.getByText("x")).toBeTruthy();
        expect(screen.getByText("y")).toBeTruthy();
    });
});
