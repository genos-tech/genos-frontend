import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { defaultColumns } from "../features/tasks/components/table/DraggableTaskTable";
import { QuickAddTaskRow } from "../features/tasks/components/table/QuickAddTaskRow";
import { QuickAddRequiredFieldsPreferenceProvider } from "../hooks/common/useQuickAddRequiredFieldsPreference";
import { UserProps } from "../types/admin";
import { TaskTableProps } from "../types/tasks";

// The avatar needs the app's AvatarContextProvider; the row under test only lists names.
vi.mock("../components/ui/avatars/UserAvatar", () => ({ UserAvatar: () => null }));

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

// Mounted under Joy's provider ALONE (MIP-1121 removed the Material editors and the
// Material ThemeProvider the table wrapped them in).

// The required-field gate is a user preference read from localStorage by
// `QuickAddRequiredFieldsPreferenceProvider` at mount. Seed the store
// before rendering so a test can exercise either side of the toggle.
const PREF_KEY = "genos-quick-add-required-fields-preference:v1";

const renderRow = (
    overrides: Partial<Parameters<typeof QuickAddTaskRow>[0]> = {},
    { enforceRequiredFields = false }: { enforceRequiredFields?: boolean } = {}
) => {
    window.localStorage.setItem(PREF_KEY, JSON.stringify({ enforce: enforceRequiredFields }));
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onDirtyChange = vi.fn();
    const utils = render(
        <CssVarsProvider>
            <QuickAddRequiredFieldsPreferenceProvider>
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
            </QuickAddRequiredFieldsPreferenceProvider>
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

    it("picks a status from the real popup, and Escape/Enter inside it do not discard or submit the row", async () => {
        // The popup is a portal, and React portals bubble through the React tree: a
        // keydown inside the open list reaches the row's own Enter/Escape handlers.
        const { onClose, onSubmit, titleInput } = renderRow();
        fireEvent.change(titleInput, { target: { value: "Draft" } });

        const statusSelect = screen.getAllByRole("combobox")[0];
        fireEvent.click(statusSelect);
        const listbox = await screen.findByRole("listbox");

        fireEvent.keyDown(listbox, { key: "Escape" });
        expect(onClose).not.toHaveBeenCalled();

        // reopen (Escape closed it) and pick WIP by click
        if (!screen.queryByRole("listbox")) fireEvent.click(statusSelect);
        const wip = await screen.findByRole("option", { name: /WIP/ });
        fireEvent.keyDown(wip, { key: "Enter" });
        expect(onSubmit).not.toHaveBeenCalled();
        fireEvent.click(wip);
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

        fireEvent.keyDown(titleInput, { key: "Enter" });
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: "Draft", status: "WIP" });
    });

    it("picks a priority and can go back to none", async () => {
        const { onSubmit, titleInput } = renderRow();
        fireEvent.change(titleInput, { target: { value: "Draft" } });
        const priority = screen.getAllByRole("combobox").find((c) => c.textContent === "—")!;

        fireEvent.click(priority);
        fireEvent.click(await screen.findByRole("option", { name: /High/ }));
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

        fireEvent.click(priority);
        // the first option is the "no value" dash
        fireEvent.click(within(await screen.findByRole("listbox")).getAllByRole("option")[0]);
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());

        fireEvent.keyDown(titleInput, { key: "Enter" });
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0].priority).toBeNull();
    });

    it("picks an assignee by typing and choosing, without submitting the row", async () => {
        const { onSubmit, titleInput } = renderRow();
        fireEvent.change(titleInput, { target: { value: "Draft" } });
        const member = screen.getByPlaceholderText(/member/i);

        fireEvent.focus(member);
        fireEvent.change(member, { target: { value: "test@" } });
        const option = await screen.findByRole("option", { name: /Test User/ });
        fireEvent.click(option);
        expect(onSubmit).not.toHaveBeenCalled();

        fireEvent.keyDown(titleInput, { key: "Enter" });
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0].assigneeId).toBe("user1");
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

    it("creates with only a title while a required field is unfilled (the default)", async () => {
        // Quick-add is the fast path: by default the project's creation
        // policy does not gate it, matching the sub-task quick-add.
        const { onSubmit, titleInput } = renderRow({
            fieldRules: { effortLevel: { required: true } },
        });

        fireEvent.change(titleInput, { target: { value: "Fast task" } });
        fireEvent.keyDown(titleInput, { key: "Enter" });

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0]).toMatchObject({
            title: "Fast task",
            effortLevel: null,
        });
    });

    it("refuses to create while a required field is missing once enforcement is on", async () => {
        const { onSubmit, titleInput, getByText } = renderRow(
            { fieldRules: { effortLevel: { required: true } } },
            { enforceRequiredFields: true }
        );

        fireEvent.change(titleInput, { target: { value: "Blocked task" } });
        fireEvent.keyDown(titleInput, { key: "Enter" });

        await waitFor(() => expect(getByText("Required: Effort Level")).toBeInTheDocument());
        expect(onSubmit).not.toHaveBeenCalled();
        expect(titleInput.value).toBe("Blocked task");
    });

    it("passes the gate when a required field is satisfied by its default", async () => {
        const { onSubmit, titleInput } = renderRow(
            {
                projectTags: [debugTag],
                fieldRules: { tags: { required: true, defaultTagNames: ["debug"] } },
            },
            { enforceRequiredFields: true }
        );

        fireEvent.change(titleInput, { target: { value: "Tagged task" } });
        fireEvent.keyDown(titleInput, { key: "Enter" });

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0].tags).toEqual([debugTag]);
    });
});
