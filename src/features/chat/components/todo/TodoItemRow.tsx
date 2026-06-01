import { ReactNode, useEffect, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import SubdirectoryArrowRightRoundedIcon from "@mui/icons-material/SubdirectoryArrowRightRounded";
import { Box, Checkbox, IconButton, Input, Link, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { TodoCategoryProps, TodoItemProps } from "../../../../types/chat";
import { CategoryPickerMenu } from "./CategoryPickerMenu";
import { TodoNotesEditor } from "./TodoNotesEditor";

interface TodoItemRowProps {
    item: TodoItemProps;
    categories: TodoCategoryProps[];
    // Direct children of this row. Empty on rows that are themselves
    // children (one-level nesting cap).
    subitems?: TodoItemProps[];
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useTEM: TeamManagementState;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    socket: Socket | null;
    onToggleComplete: (itemId: number, isCompleted: boolean) => void;
    onTitleCommit: (itemId: number, title: string) => void;
    onNotesCommit: (itemId: number, notes: PartialBlock[] | null) => void;
    onCategoryChange: (itemId: number, categoryId: number | null) => void;
    onDelete: (itemId: number) => void;
    onCategoryCreate: (name: string) => Promise<TodoCategoryProps | undefined>;
    // Append a new child under this row's parent (top-level row's
    // own item_id, or — when this row is itself a child rendered by
    // its own parent — undefined).
    onAddSubitem?: (parentItemId: number, title: string) => Promise<void>;
}

const NOTES_SAVE_INTERVAL_MS = 2000;

// BlockNote refuses an empty initialContent array, so seed one empty
// paragraph when the item has no notes yet. We treat a body that's
// just this single empty paragraph as "no notes" on save, persisting
// null back to the server.
const EMPTY_NOTES_BODY: PartialBlock[] = [
    {
        type: "paragraph",
        props: { textColor: "default", textAlignment: "left", backgroundColor: "default" },
        content: [],
        children: [],
    },
];

const isEffectivelyEmpty = (body: PartialBlock[]): boolean => {
    if (body.length === 0) return true;
    if (body.length > 1) return false;
    const only = body[0];
    if (only.type !== "paragraph") return false;
    const content = only.content;
    if (!content) return true;
    if (Array.isArray(content) && content.length === 0) return true;
    return false;
};

const ensureNonEmpty = (body: PartialBlock[] | null | undefined): PartialBlock[] => {
    if (!body || body.length === 0) return EMPTY_NOTES_BODY;
    return body;
};

// Two link forms are recognized inside the otherwise-plain title:
//   * Markdown links — [label](https://…) → the *label* becomes clickable.
//   * Bare http(s) URLs — https://… → the URL itself becomes clickable.
// The title is still stored verbatim as plain text (the raw "[label](url)"
// markdown included); this only changes how it's drawn in the row's read
// state, and edit mode shows the raw text back so links stay editable.
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s]+)/g;

// Only http(s) links are allowed through, so a "[x](javascript:…)" stays inert
// plain text — building <Link> elements here then carries no injection risk.
const isSafeHref = (url: string): boolean => /^https?:\/\//i.test(url);

const renderTitleWithLinks = (text: string): ReactNode => {
    const out: ReactNode[] = [];
    let lastIndex = 0;
    for (const match of text.matchAll(LINK_RE)) {
        const [whole, mdLabel, mdUrl, bareUrl] = match;
        const start = match.index;

        let label: string;
        let href: string;
        let consumed: number;
        if (mdUrl !== undefined) {
            // Unsafe markdown href: leave the whole "[label](url)" as text.
            if (!isSafeHref(mdUrl)) continue;
            href = mdUrl;
            label = mdLabel;
            consumed = whole.length;
        } else {
            // Bare URL: don't swallow trailing sentence punctuation
            // (e.g. "see https://x.com." or a URL wrapped in parens).
            href = bareUrl.replace(/[.,;:!?)\]}'"]+$/, "");
            label = href;
            consumed = href.length;
        }

        if (start > lastIndex) out.push(text.slice(lastIndex, start));
        out.push(
            // onClick stopPropagation: opening the link must not also flip
            // the row into edit mode.
            <Link
                key={start}
                href={href}
                rel="noopener noreferrer"
                sx={{ fontSize: "inherit", color: "primary.500" }}
                target="_blank"
                underline="always"
                onClick={(e) => e.stopPropagation()}
            >
                {label}
            </Link>
        );
        lastIndex = start + consumed;
    }
    if (lastIndex < text.length) out.push(text.slice(lastIndex));
    return out;
};

// Scheme-less but clearly domain-shaped text: "example.com", "www.x.io/path".
// Requires a dotted alphabetic TLD and no whitespace, so ordinary text pasted
// over a selection isn't mistaken for a link.
const SCHEME_LESS_DOMAIN_RE = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i;

// Common web TLDs, used to tell a bare scheme-less domain ("example.com") apart
// from a dotted word like "Node.js" or "file.txt" pasted over a selection. Not
// exhaustive — an unrecognized bare TLD simply isn't auto-linked (paste with an
// https:// scheme or a /path to force it). Deliberately omits extensions that
// happen to be ccTLDs (py, rs, sh, md, …) since a pasted word is far likelier
// than those bare domains in a todo title.
// prettier-ignore
const COMMON_TLDS = new Set([
    "com", "org", "net", "edu", "gov", "mil", "int", "io", "co", "ai",
    "app", "dev", "xyz", "info", "biz", "me", "tv", "cc", "cloud", "tech",
    "online", "site", "store", "blog", "page", "link", "live", "news",
    "us", "uk", "ca", "de", "fr", "jp", "cn", "au", "in", "br", "ru",
    "nl", "eu", "ch", "es", "it", "se", "no", "fi", "dk", "kr", "sg",
    "hk", "tw", "nz", "ie", "be", "at", "pt", "pl", "cz", "mx", "za",
]);

// Decide whether pasted clipboard text should become a link, returning the
// normalized href (https:// added when the scheme is missing) or null. Accepts
// absolute http(s) URLs and scheme-less domains; rejects everything else so a
// plain word/phrase pasted over a selection stays a normal replace.
const toLinkableUrl = (raw: string): string | null => {
    const s = raw.trim();
    if (!s || /\s/.test(s)) return null;
    if (/^https?:\/\/\S+$/i.test(s)) return s;
    if (!SCHEME_LESS_DOMAIN_RE.test(s)) return null;
    // Scheme-less + domain-shaped. Require a strong "this is a link" signal — a
    // www. prefix, an explicit /path, or a recognized web TLD — so a dotted
    // word like "Node.js" or "file.txt" stays plain text.
    const tld = (s.split("/")[0].split(":")[0].split(".").pop() ?? "").toLowerCase();
    if (/^www\./i.test(s) || s.includes("/") || COMMON_TLDS.has(tld)) {
        return `https://${s}`;
    }
    return null;
};

// Rich-text-style linking without a rich editor: when a URL is pasted over a
// non-empty selection, wrap the selected text as "[selection](url)" — which
// read mode then renders as a clickable word. Returns the rewritten value plus
// the caret position to restore, or null when the paste should fall through to
// the browser's default (no selection, or the clipboard isn't a single URL).
const linkifyPasteOverSelection = (
    value: string,
    selStart: number,
    selEnd: number,
    pasted: string
): { value: string; caret: number } | null => {
    if (selStart === selEnd) return null;
    const url = toLinkableUrl(pasted);
    if (url === null) return null;
    // Escape parens so URLs like Wikipedia's "…_(disambiguation)" don't get
    // truncated at the first ")" when the markdown link is parsed back.
    const safeUrl = url.replace(/\(/g, "%28").replace(/\)/g, "%29");
    const markdown = `[${value.slice(selStart, selEnd)}](${safeUrl})`;
    return {
        value: value.slice(0, selStart) + markdown + value.slice(selEnd),
        caret: selStart + markdown.length,
    };
};

export const TodoItemRow = (props: TodoItemRowProps) => {
    const {
        item,
        categories,
        subitems = [],
        myself,
        setMyself,
        useTEM,
        useUISM,
        useCM,
        socket,
        onToggleComplete,
        onTitleCommit,
        onNotesCommit,
        onCategoryChange,
        onDelete,
        onCategoryCreate,
        onAddSubitem,
    } = props;

    const isChild = item.parentItemId !== null;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    const [title, setTitle] = useState(item.title);
    // Read mode renders the title with clickable links; clicking the text
    // flips to an editable <Input> (an <input> can't host clickable links).
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    // Set on Escape so the blur that follows restores instead of committing.
    const skipTitleCommitRef = useRef(false);
    // The title <input> + a pending caret position, so a paste-over-selection
    // can restore the caret after we rewrite the controlled value (which would
    // otherwise bounce it to the end of the field).
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const pendingTitleCaretRef = useRef<number | null>(null);
    // Default to expanded when the item ships with actual notes content
    // (i.e. not just the placeholder empty paragraph) so the user sees
    // them without an extra click. Empty notes stay collapsed.
    const [notesExpanded, setNotesExpanded] = useState(
        () => !isEffectivelyEmpty(item.notes ?? [])
    );
    const [notesBody, setNotesBody] = useState<PartialBlock[]>(() => ensureNonEmpty(item.notes));
    const notesDirtyRef = useRef(false);

    // Subitem add: a small inline input that the user opens with the
    // "+ subitem" button. Only meaningful on top-level rows; children
    // never render the affordance (one-level nesting cap).
    const [subitemAddOpen, setSubitemAddOpen] = useState(false);
    const [newSubitemTitle, setNewSubitemTitle] = useState("");
    const handleAddSubitem = async () => {
        const t = newSubitemTitle.trim();
        if (!t || !onAddSubitem) return;
        await onAddSubitem(item.itemId, t);
        setNewSubitemTitle("");
        // Keep the input open so the user can rapid-add several.
    };

    // Sync local state when the item is refreshed from the server.
    useEffect(() => {
        setTitle(item.title);
    }, [item.title]);
    // After a paste-over-selection rewrites the title, put the caret back just
    // past the inserted "[label](url)" rather than at the end of the field.
    useEffect(() => {
        if (pendingTitleCaretRef.current !== null && titleInputRef.current) {
            const pos = pendingTitleCaretRef.current;
            titleInputRef.current.setSelectionRange(pos, pos);
            pendingTitleCaretRef.current = null;
        }
    }, [title]);
    // Paste-to-link is wired as a NATIVE listener on the real <input>, not a
    // React/Joy onPaste prop: Joy's synthetic-event forwarding fires under
    // jsdom but not on an actual browser paste. Value/selection are read off
    // the element (never a stale closure), so this stays correct as the user
    // types.
    useEffect(() => {
        const input = titleInputRef.current;
        if (!input) return;
        const onPaste = (e: ClipboardEvent) => {
            const pasted =
                e.clipboardData?.getData("text/plain") || e.clipboardData?.getData("text") || "";
            const { selectionStart, selectionEnd, value } = input;
            if (selectionStart === null || selectionEnd === null) return;
            const result = linkifyPasteOverSelection(value, selectionStart, selectionEnd, pasted);
            if (!result) return;
            e.preventDefault();
            pendingTitleCaretRef.current = result.caret;
            setTitle(result.value);
        };
        input.addEventListener("paste", onPaste);
        return () => input.removeEventListener("paste", onPaste);
    }, [isEditingTitle]);
    useEffect(() => {
        setNotesBody(ensureNonEmpty(item.notes));
    }, [item.notes]);

    // Periodic notes auto-save while expanded — mirrors the prior
    // TodoBubble cadence (was 3s for the whole-day doc; tighter here
    // since each item is small). An "effectively empty" body (single
    // empty paragraph or [] ) persists as null so the row carries no
    // notes server-side.
    useEffect(() => {
        if (!notesExpanded) return;
        const id = setInterval(() => {
            if (notesDirtyRef.current) {
                notesDirtyRef.current = false;
                onNotesCommit(item.itemId, isEffectivelyEmpty(notesBody) ? null : notesBody);
            }
        }, NOTES_SAVE_INTERVAL_MS);
        return () => clearInterval(id);
    }, [notesExpanded, notesBody, item.itemId, onNotesCommit]);

    const flushNotesIfDirty = () => {
        if (notesDirtyRef.current) {
            notesDirtyRef.current = false;
            onNotesCommit(item.itemId, isEffectivelyEmpty(notesBody) ? null : notesBody);
        }
    };

    const currentCategory = categories.find((c) => c.categoryId === item.categoryId);

    return (
        <Box
            sx={{
                borderRadius: "8px",
                px: 1,
                py: 0.75,
                "&:hover": {
                    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                },
            }}
        >
            <Stack alignItems="center" direction="row" spacing={1}>
                <Checkbox
                    checked={item.isCompleted}
                    size="sm"
                    onChange={(e) => onToggleComplete(item.itemId, e.target.checked)}
                />
                {isEditingTitle ? (
                    <Input
                        // Select a word, paste a URL → the word becomes
                        // "[word](url)"; the paste is handled by a native paste
                        // listener wired to this ref (see the effect above).
                        placeholder="Untitled todo"
                        size="sm"
                        slotProps={{ input: { ref: titleInputRef } }}
                        value={title}
                        variant="plain"
                        sx={{
                            flex: 1,
                            fontSize: "0.9rem",
                            // Sit flush with the row — no border/background chrome.
                            background: "transparent",
                            minHeight: 0,
                            py: 0,
                            "& input": {
                                px: 0,
                                textDecoration: item.isCompleted ? "line-through" : undefined,
                                opacity: item.isCompleted ? 0.55 : 1,
                            },
                        }}
                        autoFocus
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => {
                            if (skipTitleCommitRef.current) {
                                skipTitleCommitRef.current = false;
                                setTitle(item.title);
                            } else if (title !== item.title) {
                                onTitleCommit(item.itemId, title);
                            }
                            setIsEditingTitle(false);
                        }}
                        onKeyDown={(e) => {
                            // Enter commits (blur fires onTitleCommit); Escape
                            // cancels and restores the last-saved title. Both
                            // just blur — onBlur owns the commit/restore logic.
                            if (e.key === "Enter") {
                                e.preventDefault();
                                e.currentTarget.blur();
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                skipTitleCommitRef.current = true;
                                e.currentTarget.blur();
                            }
                        }}
                    />
                ) : (
                    <Box
                        sx={{
                            flex: 1,
                            fontSize: "0.9rem",
                            lineHeight: 1.5,
                            cursor: "text",
                            wordBreak: "break-word",
                            textDecoration: item.isCompleted ? "line-through" : undefined,
                            opacity: item.isCompleted ? 0.55 : 1,
                            color: title
                                ? undefined
                                : isDark
                                  ? "rgba(255,255,255,0.4)"
                                  : "rgba(0,0,0,0.4)",
                        }}
                        onClick={() => setIsEditingTitle(true)}
                    >
                        {title ? renderTitleWithLinks(title) : "Untitled todo"}
                    </Box>
                )}
                <AppTooltip title={notesExpanded ? "Collapse notes" : "Expand notes"}>
                    <IconButton
                        size="sm"
                        sx={{ borderRadius: "6px" }}
                        variant="plain"
                        onClick={() => {
                            if (notesExpanded) flushNotesIfDirty();
                            setNotesExpanded((v) => !v);
                        }}
                    >
                        {notesExpanded ? (
                            <ExpandLessRoundedIcon sx={{ fontSize: 18 }} />
                        ) : (
                            <ExpandMoreRoundedIcon sx={{ fontSize: 18 }} />
                        )}
                    </IconButton>
                </AppTooltip>
                {/* Tag picker sits right beside the subitem control. Both
                    are top-level-only actions; children inherit the parent's
                    tag, so the picker is hidden on child rows. */}
                {!isChild && (
                    <CategoryPickerMenu
                        categories={categories}
                        currentCategoryId={item.categoryId}
                        triggerLabel={currentCategory ? currentCategory.name : null}
                        onCreate={onCategoryCreate}
                        onSelect={(categoryId) => onCategoryChange(item.itemId, categoryId)}
                    />
                )}
                {/* "+ subitem" only on top-level rows. */}
                {!isChild && onAddSubitem && (
                    <AppTooltip title="Add subitem">
                        <IconButton
                            size="sm"
                            sx={{ borderRadius: "6px" }}
                            variant="plain"
                            onClick={() => setSubitemAddOpen((v) => !v)}
                        >
                            <SubdirectoryArrowRightRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </AppTooltip>
                )}
                <AppTooltip title="Delete">
                    <IconButton
                        color="danger"
                        size="sm"
                        sx={{ borderRadius: "6px" }}
                        variant="plain"
                        onClick={() => onDelete(item.itemId)}
                    >
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </AppTooltip>
            </Stack>
            {notesExpanded && (
                <Box
                    sx={{
                        mt: 0.5,
                        mx: 0,
                        borderRadius: "8px",
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        overflow: "hidden",
                        // BnTodoPreview ships with px: "10px" + BlockNote's
                        // own gutter — together they leave the cursor
                        // floating a long way from the border. Trim both
                        // down to a single small inset so there's breathing
                        // room without wasting horizontal space.
                        "& .bn-editor": { paddingInline: "16px" },
                        "& [class*='-todo-item-notes-']": { px: "24px" },
                    }}
                >
                    <TodoNotesEditor
                        body={notesBody}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                        setBody={(b) => {
                            setNotesBody(b);
                        }}
                        onEdited={() => {
                            notesDirtyRef.current = true;
                        }}
                    />
                </Box>
            )}

            {/* Subitems: render children indented under the parent
                row. Each child is a TodoItemRow with no subitems of its
                own (one-level cap) and no add-subitem affordance. */}
            {!isChild && (subitems.length > 0 || subitemAddOpen) && (
                <Box
                    sx={{
                        pl: 3,
                        ml: 1,
                        borderLeft: "2px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                    }}
                >
                    {subitems.map((child) => (
                        <TodoItemRow
                            key={child.itemId}
                            categories={categories}
                            item={child}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                            onCategoryChange={onCategoryChange}
                            onCategoryCreate={onCategoryCreate}
                            onDelete={onDelete}
                            onNotesCommit={onNotesCommit}
                            onTitleCommit={onTitleCommit}
                            onToggleComplete={onToggleComplete}
                        />
                    ))}

                    {subitemAddOpen && (
                        <Stack
                            alignItems="center"
                            direction="row"
                            spacing={1}
                            sx={{ mt: 0.25, px: 1 }}
                        >
                            <Input
                                placeholder="+ Add subitem"
                                size="sm"
                                value={newSubitemTitle}
                                variant="plain"
                                sx={{
                                    flex: 1,
                                    fontSize: "0.85rem",
                                    "& input": { px: 0 },
                                }}
                                autoFocus
                                onChange={(e) => setNewSubitemTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddSubitem();
                                    } else if (e.key === "Escape") {
                                        setSubitemAddOpen(false);
                                        setNewSubitemTitle("");
                                    }
                                }}
                            />
                            {newSubitemTitle.trim() && (
                                <IconButton
                                    size="sm"
                                    sx={{ borderRadius: "6px" }}
                                    variant="soft"
                                    onClick={handleAddSubitem}
                                >
                                    <AddIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            )}
                        </Stack>
                    )}
                </Box>
            )}
        </Box>
    );
};
