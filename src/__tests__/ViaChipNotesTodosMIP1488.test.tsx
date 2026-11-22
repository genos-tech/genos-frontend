/**
 * MIP-1488: a note version and a to-do item written through a connected AI app
 * (MCP) or an API key carry the same "via" chip as a task's history rows.
 *
 * Both surfaces are tested with and without `via` (an older API sends none: the
 * UI must be exactly today's), and the NAME of a key or app must reach only its
 * owner: on a note that is the version's editor, on a to-do (private) its owner.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TodoItemRow } from "../features/chat/components/todo/TodoItemRow";
import { ModalNoteHistory } from "../features/notes/common/components/ModalNoteHistory";
import { bumpVersionsHead } from "../features/notes/common/services/bumpVersionsHead";
import { viaSourceOfNoteVersion, viaSourceOfTodoItem } from "../features/tasks/utils/viaSource";
import type { ChatManagementState } from "../hooks/chats/useChatManagement";
import type { TeamManagementState } from "../hooks/common/useTeamManagement";
import type { UIStateManagementState } from "../hooks/common/useUIStateManagement";
import type { UserProps } from "../types/admin";
import type { TodoItemProps } from "../types/chat";
import type { NoteVersionMeta } from "../types/notes";

let isMobileViewport = false;
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => isMobileViewport }));
vi.mock("../context/authState", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../components/ui/avatars/avatarWithStatus", () => ({
    AvatarWithStatus: () => <span data-testid="avatar" />,
}));
vi.mock("../features/notes/common/services/loadNoteVersion", () => ({
    loadNoteVersion: vi.fn(async () => null),
}));

afterEach(cleanup);

const KEY = { kind: "api_key", key_name: "my-laptop-claude" };
const APP = { kind: "oauth", client_name: "Claude Desktop" };
const CLAUDE = { kind: "oauth", app: "claude", client_name: "Claude Desktop" };
const CHATGPT = { kind: "oauth", app: "chatgpt" };
const SECRETS = ["my-laptop-claude", "Claude Desktop"];

const me = { userId: "u1", userName: "Me", teamId: "t1" } as UserProps;

describe("viaSourceOfNoteVersion", () => {
    const v = (via: unknown, editorId: string | null = "u1") => ({
        via,
        editor: editorId ? { userId: editorId } : null,
    });

    it("api_key, oauth, oauth + claude and oauth + chatgpt each earn their chip", () => {
        expect(viaSourceOfNoteVersion(v(KEY), "u1")).toEqual({
            kind: "apiKey",
            name: "my-laptop-claude",
            app: null,
        });
        expect(viaSourceOfNoteVersion(v(APP), "u1")).toMatchObject({ kind: "mcp", app: null });
        expect(viaSourceOfNoteVersion(v(CLAUDE), "u1")).toMatchObject({
            kind: "mcp",
            app: "claude",
        });
        expect(viaSourceOfNoteVersion(v(CHATGPT), "u1")).toMatchObject({
            kind: "mcp",
            app: "chatgpt",
        });
    });

    it("absent, null and unknown kinds earn nothing", () => {
        expect(viaSourceOfNoteVersion({ editor: { userId: "u1" } }, "u1")).toBeNull();
        expect(viaSourceOfNoteVersion(v(null), "u1")).toBeNull();
        expect(viaSourceOfNoteVersion(v({ kind: "app" }), "u1")).toBeNull();
        expect(viaSourceOfNoteVersion(v({ kind: "agent" }), "u1")).toBeNull();
        expect(viaSourceOfNoteVersion(v({}), "u1")).toBeNull();
    });

    it("wrong types and spoofed strings never produce a chip or a mark", () => {
        for (const bad of ["oauth", 7, true, [], ["oauth"], () => 0, { kind: ["oauth"] }]) {
            expect(viaSourceOfNoteVersion(v(bad), "u1")).toBeNull();
        }
        for (const spoof of ["Claude", "claude ", "CLAUDE", "claude-evil", 1, {}, ["claude"]]) {
            expect(viaSourceOfNoteVersion(v({ kind: "oauth", app: spoof }), "u1")?.app).toBeNull();
        }
        // A name that is not a string is dropped, not stringified.
        expect(
            viaSourceOfNoteVersion(v({ kind: "api_key", key_name: { x: 1 } }), "u1")?.name
        ).toBeNull();
    });

    it("the name is read only when the viewer is the version's editor", () => {
        expect(viaSourceOfNoteVersion(v(KEY, "u2"), "u1")?.name).toBeNull();
        expect(viaSourceOfNoteVersion(v(APP, "u2"), "u1")?.name).toBeNull();
        expect(viaSourceOfNoteVersion(v(KEY, "u1"), "u1")?.name).toBe("my-laptop-claude");
        // Whatever the server sent, a stranger's version never unlocks it.
        expect(viaSourceOfNoteVersion(v(KEY, "u2"), "u2")?.name).toBe("my-laptop-claude");
    });

    it("a version with no editor, or a viewer with no id, never unlocks the name", () => {
        expect(viaSourceOfNoteVersion(v(KEY, null), "u1")?.name).toBeNull();
        expect(viaSourceOfNoteVersion(v(KEY, "u1"), null)?.name).toBeNull();
        expect(viaSourceOfNoteVersion(v(KEY, "u1"), undefined)?.name).toBeNull();
    });
});

describe("viaSourceOfTodoItem", () => {
    it("maps each kind and the owner's name", () => {
        expect(viaSourceOfTodoItem({ via: KEY })).toEqual({
            kind: "apiKey",
            name: "my-laptop-claude",
            app: null,
        });
        expect(viaSourceOfTodoItem({ via: CLAUDE })).toEqual({
            kind: "mcp",
            name: "Claude Desktop",
            app: "claude",
        });
        expect(viaSourceOfTodoItem({ via: CHATGPT })).toEqual({
            kind: "mcp",
            name: null,
            app: "chatgpt",
        });
    });

    it("absent, null, wrong types and unknown kinds earn nothing", () => {
        expect(viaSourceOfTodoItem({})).toBeNull();
        expect(viaSourceOfTodoItem({ via: null })).toBeNull();
        expect(viaSourceOfTodoItem({ via: "api_key" })).toBeNull();
        expect(viaSourceOfTodoItem({ via: 3 })).toBeNull();
        expect(viaSourceOfTodoItem({ via: { kind: "app" } })).toBeNull();
        expect(viaSourceOfTodoItem({ via: { kind: "oauth", app: "Claude" } })?.app).toBeNull();
    });
});

const version = (over: Partial<NoteVersionMeta> = {}): NoteVersionMeta => ({
    versionNo: 2,
    editor: { userId: "u1", userName: "Me", avatarUrl: null },
    title: "T",
    restoredFromVersionNo: null,
    tsCreatedAt: "",
    tsUpdatedAt: new Date().toISOString(),
    ...over,
});

const renderHistory = (versions: NoteVersionMeta[]) =>
    render(
        <CssVarsProvider>
            <ModalNoteHistory
                myself={me}
                noteId={1}
                noteType={1}
                setMyself={vi.fn()}
                socket={null}
                useCM={{} as unknown as ChatManagementState}
                useUISM={{} as unknown as UIStateManagementState}
                useNM={
                    {
                        currentNoteVersions: versions,
                        currentNoteMembers: [{ userId: "u1", roleId: 1 }],
                    } as never
                }
                open
                onClose={vi.fn()}
            />
        </CssVarsProvider>
    );

const leaks = () => SECRETS.filter((s) => document.body.innerHTML.includes(s));

describe("note history rows", () => {
    it("an older API (no via) shows today's list: no chip anywhere", () => {
        renderHistory([version(), version({ versionNo: 1 })]);
        expect(screen.queryByText("via MCP")).toBeNull();
        expect(screen.queryByText("via API key")).toBeNull();
        expect(screen.queryByRole("img")).toBeNull();
        expect(document.querySelector("[data-via]")).toBeNull();
        expect(screen.getByText(/v2 · Me/)).toBeInTheDocument();
    });

    it("null via and an unknown kind show no chip", () => {
        renderHistory([version({ via: null }), version({ versionNo: 1, via: { kind: "agent" } })]);
        expect(screen.queryByText("via MCP")).toBeNull();
        expect(screen.queryByText("via API key")).toBeNull();
    });

    it("api_key and oauth show their words, each on its own row", () => {
        renderHistory([version({ via: KEY }), version({ versionNo: 1, via: APP })]);
        expect(screen.getAllByText("via API key")).toHaveLength(1);
        expect(screen.getAllByText("via MCP")).toHaveLength(1);
        // The person stays on the row: nothing is removed.
        expect(screen.getByText(/v2 · Me/)).toBeInTheDocument();
        expect(screen.getByText(/v1 · Me/)).toBeInTheDocument();
    });

    it("oauth + claude and oauth + chatgpt show the official mark with the words as its name", () => {
        renderHistory([version({ via: CLAUDE }), version({ versionNo: 1, via: CHATGPT })]);
        expect(screen.getByRole("img", { name: "via Claude" })).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "via ChatGPT" })).toBeInTheDocument();
        expect(screen.queryByText("via MCP")).toBeNull();
    });

    it("the name reaches the editor (a version of mine) and nobody else", () => {
        renderHistory([
            version({ versionNo: 3, via: KEY }),
            version({
                versionNo: 2,
                editor: { userId: "u2", userName: "Ann", avatarUrl: null },
                // Even if a server forgot to reduce it.
                via: { kind: "api_key", key_name: "anns-secret-key" },
            }),
        ]);
        expect(screen.getByLabelText(/my-laptop-claude/)).toBeInTheDocument();
        expect(document.body.innerHTML).not.toContain("anns-secret-key");
        expect(screen.getAllByText("via API key")).toHaveLength(2);
    });

    it("a colleague's version shows the kind only", () => {
        renderHistory([
            version({
                editor: { userId: "u2", userName: "Ann", avatarUrl: null },
                via: { ...CLAUDE, ...KEY, kind: "oauth" },
            }),
        ]);
        expect(screen.getByRole("img", { name: "via Claude" })).toBeInTheDocument();
        expect(leaks()).toEqual([]);
    });
});

const todo = (over: Partial<TodoItemProps> = {}): TodoItemProps => ({
    itemId: 88,
    groupId: 1,
    categoryId: null,
    parentItemId: null,
    title: "ship the fix",
    notes: null,
    isCompleted: false,
    sortOrder: 0,
    tsCreatedAt: "2026-07-12T00:00:00Z",
    tsUpdatedAt: "2026-07-12T00:00:00Z",
    tsCompletedAt: null,
    ...over,
});

const renderTodo = (item: TodoItemProps) =>
    render(
        <CssVarsProvider>
            <TodoItemRow
                categories={[]}
                item={item}
                localDate="2026-07-12"
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
                onTitleCommit={vi.fn()}
                onToggleComplete={vi.fn()}
            />
        </CssVarsProvider>
    );

describe("to-do rows", () => {
    it("no via (an older API, or typed by the member): today's row, no chip", () => {
        renderTodo(todo());
        expect(screen.getByText("ship the fix")).toBeInTheDocument();
        expect(screen.queryByText("via MCP")).toBeNull();
        expect(screen.queryByText("via API key")).toBeNull();
        expect(screen.queryByRole("img")).toBeNull();
        cleanup();
        renderTodo(todo({ via: null }));
        expect(document.querySelector("[data-via]")).toBeNull();
    });

    it("api_key and oauth show the words, the title stays", () => {
        renderTodo(todo({ via: KEY }));
        expect(screen.getByText("via API key")).toBeInTheDocument();
        expect(screen.getByText("ship the fix")).toBeInTheDocument();
        cleanup();
        renderTodo(todo({ via: APP }));
        expect(screen.getByText("via MCP")).toBeInTheDocument();
    });

    it("the official marks carry the words as their accessible name", () => {
        renderTodo(todo({ via: CLAUDE }));
        expect(screen.getByRole("img", { name: "via Claude" })).toBeInTheDocument();
        cleanup();
        renderTodo(todo({ via: CHATGPT }));
        expect(screen.getByRole("img", { name: "via ChatGPT" })).toBeInTheDocument();
    });

    it("the owner reads the key's name in the tooltip label", () => {
        renderTodo(todo({ via: KEY }));
        expect(screen.getByLabelText(/my-laptop-claude/)).toBeInTheDocument();
    });

    it("a spoofed family is the generic chip, never a mark", () => {
        renderTodo(todo({ via: { kind: "oauth", app: "Claude " } }));
        expect(screen.getByText("via MCP")).toBeInTheDocument();
        expect(screen.queryByRole("img")).toBeNull();
    });
});

describe("a local save never extends a row an app wrote (MIP-1488)", () => {
    const meNow = { userId: "u1", userName: "Me", avatarImgPath: "" };
    const now = Date.parse("2026-11-14T12:00:00Z");
    const head = (over: Partial<NoteVersionMeta> = {}): NoteVersionMeta =>
        version({ versionNo: 4, tsUpdatedAt: "2026-11-14T11:58:00Z", ...over });

    it("my own recent typed head is extended, as before", () => {
        const out = bumpVersionsHead([head()], meNow, now);
        expect(out).toHaveLength(1);
        expect(out[0].versionNo).toBe(4);
        expect(out[0].tsUpdatedAt).toBe("2026-11-14T12:00:00.000Z");
    });

    it("my own recent head written through an API key or app starts a new row without via", () => {
        for (const via of [KEY, APP, CLAUDE]) {
            const out = bumpVersionsHead([head({ via })], meNow, now);
            expect(out).toHaveLength(2);
            expect(out[0].versionNo).toBe(5);
            expect(out[0].via).toBeUndefined();
            expect(out[1].via).toEqual(via);
        }
    });
});

describe("to-do rows on a phone", () => {
    it("the generic chip is icon-only: the words are its accessible name", async () => {
        isMobileViewport = true;
        renderTodo(todo({ via: KEY }));
        expect(screen.getByRole("img", { name: "via API key" })).toBeInTheDocument();
        expect(screen.queryByText("via API key")).toBeNull();
        cleanup();
        renderTodo(todo({ via: APP }));
        expect(screen.getByRole("img", { name: "via MCP" })).toBeInTheDocument();
        expect(screen.queryByText("via MCP")).toBeNull();
        cleanup();
        renderTodo(todo({ via: CLAUDE }));
        expect(screen.getByRole("img", { name: "via Claude" })).toBeInTheDocument();
        isMobileViewport = false;
    });
});
