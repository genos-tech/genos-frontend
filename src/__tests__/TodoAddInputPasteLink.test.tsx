import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TodoCategorySection } from "../features/chat/components/todo/TodoCategorySection";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { UserProps } from "../types/admin";

// Regression: paste-to-link must work in the "+ Add item" field of a fresh
// section, not only when editing an existing item's title.
describe("TodoCategorySection — paste-a-URL-over-a-selection in the add-item field", () => {
    const renderSection = () =>
        render(
            <CssVarsProvider>
                <TodoCategorySection
                    categories={[]}
                    categoryId={null}
                    items={[]}
                    myself={{} as UserProps}
                    setMyself={vi.fn()}
                    socket={null}
                    title="General"
                    useCM={{} as unknown as ChatManagementState}
                    useTEM={{} as unknown as TeamManagementState}
                    useUISM={{} as unknown as UIStateManagementState}
                    onAddItem={vi.fn()}
                    onAddSubitem={vi.fn()}
                    onCategoryCreate={vi.fn()}
                    onDeleteItem={vi.fn()}
                    onPatchItem={vi.fn()}
                />
            </CssVarsProvider>
        );

    it("wraps the selected word as [word](url) on paste", () => {
        const { getByPlaceholderText } = renderSection();
        const input = getByPlaceholderText("+ Add item") as HTMLInputElement;

        // Type a title, select "spec", then paste a URL over it.
        fireEvent.change(input, { target: { value: "Read spec" } });
        input.focus();
        input.setSelectionRange(5, 9);
        fireEvent.paste(input, { clipboardData: { getData: () => "example.com" } });

        expect(input.value).toBe("Read [spec](https://example.com)");
    });
});
