/**
 * MIP-1386: the add button next to the new-tag field in the to-do row menu is
 * an icon-only button, so it needs an accessible name.
 * (Every locale has the string: localeCatalogCoverage.test.ts pins that.)
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TodoItemMoreMenu } from "../features/chat/components/todo/TodoItemMoreMenu";
import { en } from "../i18n/locales/en";

vi.mock("../hooks/common/UrlLinkModalContext", () => ({
    useUrlLinkModal: () => ({ openModalByHref: vi.fn() }),
}));

afterEach(cleanup);

describe("the to-do row menu add-tag button", () => {
    it("is reachable by its name once the menu is open", () => {
        render(
            <CssVarsProvider>
                <TodoItemMoreMenu
                    categories={[]}
                    currentCategoryId={null}
                    isChild={false}
                    linkCopied={false}
                    notesExpanded={false}
                    onCopyLink={vi.fn()}
                    onCreateCategory={vi.fn()}
                    onCreateTask={vi.fn()}
                    onDelete={vi.fn()}
                    onSelectCategory={vi.fn()}
                />
            </CssVarsProvider>
        );
        fireEvent.click(screen.getByRole("button", { name: en.chat.todoPane.moreOptions }));
        const add = screen.getByRole("button", { name: en.chat.todoPane.addTag });
        // Empty field: disabled, but still named (the name is what a reader announces).
        expect(add).toBeDisabled();
    });
});
