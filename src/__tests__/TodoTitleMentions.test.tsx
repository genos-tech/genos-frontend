import { ReactNode } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentMentionCandidate } from "../features/agentQA/mentions/types";
import {
    resolveTitleMentions,
    TodoMentionPoolProvider,
    type TodoMentionPool,
} from "../features/chat/components/todo/titleMentions";
import { TodoCategorySection } from "../features/chat/components/todo/TodoCategorySection";
import { TodoItemRow } from "../features/chat/components/todo/TodoItemRow";
import { ChatManagementState } from "../hooks/chats/useChatManagement";
import { TeamManagementState } from "../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import { UserProps } from "../types/admin";
import { TodoItemProps } from "../types/chat";

// The preview modal a "#" chip opens is the same one a title URL opens, so
// the row reaches it through UrlLinkModalContext — stubbed here to assert
// the href the chip hands over.
const openModalByHref = vi.fn();
vi.mock("../hooks/common/UrlLinkModalContext", () => ({
    useUrlLinkModal: () => ({ openModalByHref }),
}));

const TASK_HREF = "/workspace/tasks/project/3/task/7";

// A pool as `TodoMentionsProvider` would build it: a user (no href — a
// person has nowhere to open) and a task (clickable).
const MEMBERS: AgentMentionCandidate[] = [
    { ref: { kind: "user", userId: "u1", label: "Alice" }, trigger: "@", key: "user:u1" },
];
const ENTITIES: AgentMentionCandidate[] = [
    {
        ref: { kind: "task", taskId: 7, label: "Fix login" },
        trigger: "#",
        key: "task:7",
        href: TASK_HREF,
    },
];
const POOL: TodoMentionPool = {
    members: MEMBERS,
    entities: ENTITIES,
    refs: [...MEMBERS, ...ENTITIES].map((c) => c.ref),
    hrefByKey: new Map([["task:7", TASK_HREF]]),
    refreshEntities: () => {},
};

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

const wrap = (children: ReactNode) => (
    <CssVarsProvider>
        <TodoMentionPoolProvider pool={POOL}>{children}</TodoMentionPoolProvider>
    </CssVarsProvider>
);

const renderRow = (title: string) =>
    render(
        wrap(
            <TodoItemRow
                categories={[]}
                item={makeItem(title)}
                localDate="2026-06-01"
                myself={{ userId: "u1" } as UserProps}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as unknown as ChatManagementState}
                useTEM={{} as unknown as TeamManagementState}
                useUISM={{} as unknown as UIStateManagementState}
                onCategoryChange={vi.fn()}
                onCategoryCreate={vi.fn()}
                onDelete={vi.fn()}
                onNotesCommit={vi.fn()}
                onTitleCommit={vi.fn()}
                onToggleComplete={vi.fn()}
            />
        )
    );

const titleEditor = (container: HTMLElement): HTMLInputElement | null =>
    container.querySelector('input:not([type="checkbox"])');

describe("resolveTitleMentions", () => {
    it("finds both trigger kinds and attaches the href only where one exists", () => {
        const found = resolveTitleMentions("Ping @Alice about #Fix login", POOL);
        expect(found.map((m) => [m.ref.label, m.href])).toEqual([
            ["Alice", undefined],
            ["Fix login", TASK_HREF],
        ]);
    });

    it("ignores a token whose label no longer matches anything (renamed entity)", () => {
        expect(resolveTitleMentions("Ping @Alicia about #Fix logout", POOL)).toEqual([]);
    });

    it("costs nothing on an ordinary title", () => {
        expect(resolveTitleMentions("Buy milk", POOL)).toEqual([]);
    });
});

describe("TodoItemRow — a saved mention renders as a chip in the row", () => {
    beforeEach(() => vi.clearAllMocks());

    it("draws the token as a chip while keeping the stored title plain text", () => {
        const { container, getByText } = renderRow("Ping @Alice about #Fix login");
        // Each token is its own element — proof it was chipped rather than
        // left as part of the surrounding sentence.
        const chip = getByText("@Alice");
        expect(getByText("#Fix login")).toBeTruthy();
        // The row still READS as the exact stored characters, trigger
        // included, and edit mode hands them back verbatim.
        const readBox = chip.parentElement as HTMLElement;
        expect(readBox.textContent).toBe("Ping @Alice about #Fix login");
        fireEvent.click(readBox);
        expect(titleEditor(container)?.value).toBe("Ping @Alice about #Fix login");
    });

    it("opens the preview modal for a chip that has a link, without entering edit mode", () => {
        const { container, getByText } = renderRow("Blocked by #Fix login");
        fireEvent.click(getByText("#Fix login"));
        expect(openModalByHref).toHaveBeenCalledWith(TASK_HREF);
        // stopPropagation: the click must not also flip the row into editing.
        expect(titleEditor(container)).toBeNull();
    });

    it("leaves a chip with no link inert — the click falls through to edit mode", () => {
        const { container, getByText } = renderRow("Ask @Alice");
        fireEvent.click(getByText("@Alice"));
        expect(openModalByHref).not.toHaveBeenCalled();
        expect(titleEditor(container)?.value).toBe("Ask @Alice");
    });

    it("offers the picker in the row's title editor too", async () => {
        const { container, getByText } = renderRow("Ask Alice");
        fireEvent.click(getByText("Ask Alice"));
        const input = titleEditor(container) as HTMLInputElement;

        fireEvent.change(input, { target: { value: "Ask @Al" } });
        expect(await screen.findByTestId("agent-mention-dropdown")).toBeInTheDocument();
        // Enter completes the mention instead of committing the edit.
        fireEvent.keyDown(input, { key: "Enter" });
        await waitFor(() => expect(input.value).toBe("Ask @Alice "));
        expect(titleEditor(container)).not.toBeNull();
    });

    it("does not chip a token that sits inside a link", () => {
        const { getByText } = renderRow("See [#Fix login](https://example.com/x)");
        // The markdown label stays one link, so no chip element is emitted
        // for the "#Fix login" inside it.
        const link = getByText("#Fix login");
        expect(link.tagName).toBe("A");
    });
});

describe("TodoCategorySection — the '+ Add item' field takes @ and #", () => {
    beforeEach(() => vi.clearAllMocks());

    const renderSection = (onAddItem = vi.fn()) => {
        const utils = render(
            wrap(
                <TodoCategorySection
                    categories={[]}
                    categoryId={null}
                    items={[]}
                    localDate="2026-06-01"
                    myself={{ userId: "u1" } as UserProps}
                    setMyself={vi.fn()}
                    socket={null}
                    title="General"
                    useCM={{} as unknown as ChatManagementState}
                    useTEM={{} as unknown as TeamManagementState}
                    useUISM={{} as unknown as UIStateManagementState}
                    onAddItem={onAddItem}
                    onAddSubitem={vi.fn()}
                    onCategoryCreate={vi.fn()}
                    onDeleteItem={vi.fn()}
                    onPatchItem={vi.fn()}
                />
            )
        );
        return { ...utils, onAddItem };
    };

    it("Enter completes the highlighted mention instead of adding the item", async () => {
        const { getByPlaceholderText, onAddItem } = renderSection();
        const input = getByPlaceholderText("+ Add item") as HTMLInputElement;

        fireEvent.change(input, { target: { value: "Ping @Al" } });
        expect(await screen.findByTestId("agent-mention-dropdown")).toBeInTheDocument();

        fireEvent.keyDown(input, { key: "Enter" });
        expect(onAddItem).not.toHaveBeenCalled();
        await waitFor(() => expect(input.value).toBe("Ping @Alice "));

        // Picker closed — the next Enter is the host's again, and the item
        // is stored as the plain text that was typed.
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onAddItem).toHaveBeenCalledWith("Ping @Alice", null);
    });

    it("completes a # entity by its full multi-word title", async () => {
        const { getByPlaceholderText } = renderSection();
        const input = getByPlaceholderText("+ Add item") as HTMLInputElement;

        fireEvent.change(input, { target: { value: "#Fix" } });
        expect(await screen.findByTestId("agent-mention-dropdown")).toBeInTheDocument();
        fireEvent.keyDown(input, { key: "Enter" });
        await waitFor(() => expect(input.value).toBe("#Fix login "));
    });
});
