import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TodoItemRow } from "../features/chat/components/todo/TodoItemRow";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { UserProps } from "../types/admin";
import { TodoItemProps } from "../types/chat";

const makeItem = (title: string): TodoItemProps => ({
    itemId: 1,
    groupId: 1,
    categoryId: null,
    parentItemId: null,
    title,
    notes: null,
    isCompleted: false,
    sortOrder: 0,
    tsCreatedAt: "2026-06-01T00:00:00Z",
    tsUpdatedAt: "2026-06-01T00:00:00Z",
    tsCompletedAt: null,
});

const renderRow = (title: string, onTitleCommit = vi.fn()) => {
    const utils = render(
        <CssVarsProvider>
            <TodoItemRow
                categories={[]}
                item={makeItem(title)}
                myself={{} as UserProps}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as unknown as ChatManagementState}
                useTEM={{} as unknown as TeamManagementState}
                useUISM={{} as unknown as UIStateManagementState}
                onCategoryChange={vi.fn()}
                onCategoryCreate={vi.fn()}
                onDelete={vi.fn()}
                onNotesCommit={vi.fn()}
                onTitleCommit={onTitleCommit}
                onToggleComplete={vi.fn()}
            />
        </CssVarsProvider>
    );
    return { ...utils, onTitleCommit };
};

// Enter edit mode (the title is a read-only Box until clicked) and return the
// underlying <input>.
const openEditor = (
    container: HTMLElement,
    getByText: (t: string) => HTMLElement,
    title: string
) => {
    fireEvent.click(getByText(title));
    // The first <input> is the Checkbox; the title editor is the text input.
    const input = container.querySelector('input:not([type="checkbox"])') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe(title);
    return input;
};

const pasteOver = (input: HTMLInputElement, start: number, end: number, clip: string) => {
    input.focus();
    input.setSelectionRange(start, end);
    fireEvent.paste(input, { clipboardData: { getData: () => clip } });
};

describe("TodoItemRow — paste-a-URL-over-a-selection makes the word a link", () => {
    beforeEach(() => vi.clearAllMocks());

    it("wraps the selected word as [word](url) when a full https URL is pasted", () => {
        const { container, getByText } = renderRow("Read spec");
        const input = openEditor(container, getByText, "Read spec");
        pasteOver(input, 5, 9, "https://example.com"); // select "spec"
        expect(input.value).toBe("Read [spec](https://example.com)");
    });

    it("works for a scheme-less URL by normalizing to https", () => {
        const { container, getByText } = renderRow("Read spec");
        const input = openEditor(container, getByText, "Read spec");
        pasteOver(input, 5, 9, "example.com");
        expect(input.value).toBe("Read [spec](https://example.com)");
    });

    it("works for a www. URL", () => {
        const { container, getByText } = renderRow("Read spec");
        const input = openEditor(container, getByText, "Read spec");
        pasteOver(input, 5, 9, "www.example.com/docs");
        expect(input.value).toBe("Read [spec](https://www.example.com/docs)");
    });

    it("leaves a non-URL paste to the browser default (no rewrite)", () => {
        const { container, getByText } = renderRow("Read spec");
        const input = openEditor(container, getByText, "Read spec");
        pasteOver(input, 5, 9, "just some words");
        // jsdom performs no default paste, so the value is unchanged — the key
        // point is that our handler did NOT rewrite it into a link.
        expect(input.value).toBe("Read spec");
    });
});
