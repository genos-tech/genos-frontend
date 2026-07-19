import { CssVarsProvider } from "@mui/joy/styles";
import { createTheme, THEME_ID, ThemeProvider } from "@mui/material/styles";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultColumns } from "../features/tasks/components/table/DraggableTaskTable";
import { QuickAddTaskRow } from "../features/tasks/components/table/QuickAddTaskRow";
import { UserProps } from "../types/admin";
import { TaskTableProps } from "../types/tasks";

const myself: UserProps = {
    teamId: "team1",
    teamName: "Team One",
    userId: "user1",
    userName: "Test User",
    userEmail: "test@test.com",
    avatarImgPath: "",
    tsLastSeen: "",
    tsJoined: "",
    customStatus: "",
} as unknown as UserProps;

const parentTask = {
    id: "10",
    title: "Parent",
    parentTaskId: null,
    rootTaskId: 10,
    projectId: 42,
    tags: [],
} as unknown as TaskTableProps;

const TITLE_PLACEHOLDER = "Type a title, Enter to create…";

// The row mixes Joy and Material components; Material ones need the
// scoped Material theme under THEME_ID (same setup DraggableTaskTable
// provides in the app) or they crash reading Joy's theme shape.
const materialTheme = createTheme({ cssVariables: true });

const renderRow = (overrides: Partial<Parameters<typeof QuickAddTaskRow>[0]> = {}) => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onDirtyChange = vi.fn();
    const utils = render(
        <CssVarsProvider>
            <ThemeProvider theme={{ [THEME_ID]: materialTheme }}>
                <QuickAddTaskRow
                    columns={defaultColumns}
                    creatorUserId={myself.userId}
                    depth={1}
                    fieldRules={null}
                    mode="light"
                    parentTask={parentTask}
                    projectTags={[]}
                    teamMembers={[myself]}
                    onClose={onClose}
                    onDirtyChange={onDirtyChange}
                    onSubmit={onSubmit}
                    {...overrides}
                />
            </ThemeProvider>
        </CssVarsProvider>
    );
    const titleInput = utils.getByPlaceholderText(TITLE_PLACEHOLDER) as HTMLInputElement;
    return { ...utils, onSubmit, onClose, onDirtyChange, titleInput };
};

describe("QuickAddTaskRow", () => {
    it("submits the full draft on Enter and closes the row on success", async () => {
        const { onSubmit, onClose, titleInput } = renderRow();

        fireEvent.change(titleInput, { target: { value: "  New child task  " } });
        fireEvent.keyDown(titleInput, { key: "Enter" });

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith({
            title: "New child task",
            // New tasks default to unassigned.
            assigneeId: null,
            status: "Open",
            priority: null,
            effortLevel: null,
            dueDate: null,
            tags: [],
        });
        // The row disappears once the task is created.
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("does not submit an empty or whitespace-only title", async () => {
        const { onSubmit, titleInput } = renderRow();

        fireEvent.keyDown(titleInput, { key: "Enter" });
        fireEvent.change(titleInput, { target: { value: "   " } });
        fireEvent.keyDown(titleInput, { key: "Enter" });

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it("guards against a duplicate Enter while a submit is in flight", async () => {
        let resolveSubmit: () => void = () => {};
        const onSubmit = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveSubmit = resolve;
                })
        );
        const { onClose, titleInput } = renderRow({ onSubmit });

        fireEvent.change(titleInput, { target: { value: "Task A" } });
        fireEvent.keyDown(titleInput, { key: "Enter" });
        fireEvent.keyDown(titleInput, { key: "Enter" });

        // The second Enter is swallowed by the in-flight guard.
        expect(onSubmit).toHaveBeenCalledTimes(1);
        resolveSubmit();
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("closes on Escape", () => {
        const { onClose, titleInput } = renderRow();
        fireEvent.keyDown(titleInput, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes on an outside mousedown only while the title is empty", () => {
        const { onClose, titleInput } = renderRow();

        fireEvent.mouseDown(document.body);
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.change(titleInput, { target: { value: "unsaved draft" } });
        fireEvent.mouseDown(document.body);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does NOT treat clicks inside MUI portal popups as outside clicks", () => {
        // MUI Select/Autocomplete render their popups in portals attached
        // to document.body — outside the row's DOM subtree. A click on a
        // menu option must not dismiss the row (regression pin for the
        // portal gotcha).
        const { onClose } = renderRow();

        for (const wrap of [
            () => {
                const el = document.createElement("div");
                el.className = "MuiAutocomplete-popper";
                return el;
            },
            () => {
                const el = document.createElement("ul");
                el.setAttribute("role", "listbox");
                return el;
            },
            () => {
                const el = document.createElement("div");
                el.className = "MuiPopover-root";
                return el;
            },
        ]) {
            const popup = wrap();
            const option = document.createElement("li");
            popup.appendChild(option);
            document.body.appendChild(popup);
            fireEvent.mouseDown(option);
            popup.remove();
        }

        expect(onClose).not.toHaveBeenCalled();
    });

    it("shows the inline error and preserves the draft when the submit rejects", async () => {
        const onSubmit = vi.fn().mockRejectedValue(new Error("boom"));
        const { titleInput, getByText } = renderRow({ onSubmit });

        fireEvent.change(titleInput, { target: { value: "Doomed task" } });
        fireEvent.keyDown(titleInput, { key: "Enter" });

        await waitFor(() => expect(getByText("Couldn't create — try again")).toBeInTheDocument());
        expect(titleInput.value).toBe("Doomed task");
    });

    // ---- Project field rules (required metadata + defaults) ----

    const debugTag = { tagName: "debug", tagColor: "#111111", tagTextColor: "#ffffff" };

    it("seeds its initial state from the project's configured defaults", async () => {
        const { onSubmit, titleInput, getByText } = renderRow({
            projectTags: [debugTag],
            fieldRules: {
                priority: { default: "High" },
                effortLevel: { default: "Moderate" },
                tags: { defaultTagNames: ["debug"] },
                assignee: { default: "creator" },
            },
        });

        // The default tag renders as a chip in the tags cell right away.
        expect(getByText("debug")).toBeInTheDocument();

        fireEvent.change(titleInput, { target: { value: "Seeded task" } });
        fireEvent.keyDown(titleInput, { key: "Enter" });

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit).toHaveBeenCalledWith({
            title: "Seeded task",
            assigneeId: myself.userId,
            status: "Open",
            priority: "High",
            effortLevel: "Moderate",
            dueDate: null,
            tags: [debugTag],
        });
    });

    it("refuses to create while a required field is missing, naming it inline", async () => {
        const { onSubmit, titleInput, getByText } = renderRow({
            fieldRules: { effortLevel: { required: true } },
        });

        fireEvent.change(titleInput, { target: { value: "Blocked task" } });
        fireEvent.keyDown(titleInput, { key: "Enter" });

        await waitFor(() => expect(getByText("Required: Effort Level")).toBeInTheDocument());
        expect(onSubmit).not.toHaveBeenCalled();
        expect(titleInput.value).toBe("Blocked task");
    });

    it("passes the gate when a required field is satisfied by its default", async () => {
        const { onSubmit, titleInput } = renderRow({
            projectTags: [debugTag],
            fieldRules: { tags: { required: true, defaultTagNames: ["debug"] } },
        });

        fireEvent.change(titleInput, { target: { value: "Tagged task" } });
        fireEvent.keyDown(titleInput, { key: "Enter" });

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0].tags).toEqual([debugTag]);
    });
});
