import { ReactElement, ReactNode } from "react";
import {
    createReactInlineContentSpec,
    DefaultReactSuggestionItem,
    SuggestionMenuController,
} from "@blocknote/react";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Typography } from "@mui/joy";

import {
    HashMentionData,
    HashNoteEntry,
    useHashMentionData,
} from "../../context/HashMentionDataContext";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { AllChatProps } from "../../types/chat";
import { ProjectProps, TaskTableProps } from "../../types/tasks";
import { chatTypeCodeToSlug, entityRefToHref, HashEntityRef } from "../../utils/entityHref";
import { filterAndRankSuggestionItems } from "../../utils/suggestionRanking";
import { mentionChipSx, MentionPalette, MentionSuggestionMenu } from "./Mention";

// Sibling palettes to the `@` user/group chips (see `mentionChipSx`). One
// per entity type so a `#` reference reads at a glance as task vs note vs
// chat vs project.
const TASK_PALETTE: MentionPalette = {
    bg: "rgba(59, 130, 246, 0.15)",
    bgHover: "rgba(59, 130, 246, 0.28)",
    text: "#2563eb",
};
const NOTE_PALETTE: MentionPalette = {
    bg: "rgba(139, 92, 246, 0.15)",
    bgHover: "rgba(139, 92, 246, 0.28)",
    text: "#7c3aed",
};
const CHAT_PALETTE: MentionPalette = {
    bg: "rgba(20, 184, 166, 0.15)",
    bgHover: "rgba(20, 184, 166, 0.28)",
    text: "#0d9488",
};
const PROJECT_PALETTE: MentionPalette = {
    bg: "rgba(245, 158, 11, 0.15)",
    bgHover: "rgba(245, 158, 11, 0.28)",
    text: "#d97706",
};

// Shared chip body for all four `#` mention types. Clicking hands the
// rebuilt href to the URL-link modal (opens a preview for tasks / notes /
// GM chats; routes to the page for projects). `useUrlLinkModal` returns
// null outside the provider (pre-auth surfaces), so the click no-ops
// gracefully — same defensive pattern as the `@group` chip.
const HashChip = ({
    href,
    icon,
    label,
    palette,
}: {
    href: string;
    icon: ReactNode;
    label: string;
    palette: MentionPalette;
}) => {
    const urlLinkModal = useUrlLinkModal();
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        urlLinkModal?.openModalByHref(href);
    };
    return (
        <Box sx={mentionChipSx(palette)} onClick={handleClick}>
            {icon}
            <Typography
                fontWeight={"bold"}
                level="body-sm"
                sx={{
                    color: palette.text,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 260,
                }}
            >
                #{label}
            </Typography>
        </Box>
    );
};

const chipIcon = (Icon: typeof TaskAltRoundedIcon, palette: MentionPalette) => (
    <Icon sx={{ fontSize: 14, color: palette.text, mr: 0.25 }} />
);

// ── Inline content specs ────────────────────────────────────────────────
// Each is a no-arg factory (props store everything the render needs) so an
// editor adds it with one line and no new props — `render` reads the URL
// modal from context, exactly like `CreateMentionGroupSpec`. All props are
// strings so the payload round-trips through the backend untouched, the
// same wire convention as the `mentionGroup` node.

// Task — chip shows "#PRJ-12 · <title>" (preview id AND title).
export const CreateHashTaskSpec = () =>
    createReactInlineContentSpec(
        {
            type: "hashTask",
            propSchema: {
                projectId: { default: "" },
                taskId: { default: "" },
                displayId: { default: "" },
                title: { default: "" },
            },
            content: "none",
        },
        {
            render: (props) => {
                const { projectId, taskId, displayId, title } = props.inlineContent.props;
                const idText = displayId || taskId;
                const label = title ? `${idText} · ${title}` : idText;
                const href = entityRefToHref({ entityType: "task", projectId, taskId });
                return (
                    <HashChip
                        href={href}
                        icon={chipIcon(TaskAltRoundedIcon, TASK_PALETTE)}
                        label={label}
                        palette={TASK_PALETTE}
                    />
                );
            },
        }
    );

// Note — chip shows "#<note title>". `noteKind` drives the URL shape.
export const CreateHashNoteSpec = () =>
    createReactInlineContentSpec(
        {
            type: "hashNote",
            propSchema: {
                noteKind: { default: "my" },
                noteId: { default: "" },
                title: { default: "" },
                projectId: { default: "" },
                taskId: { default: "" },
                chatType: { default: "" },
                chatId: { default: "" },
                threadId: { default: "0" },
            },
            content: "none",
        },
        {
            render: (props) => {
                const { noteKind, noteId, title, projectId, taskId, chatType, chatId, threadId } =
                    props.inlineContent.props;
                let ref: HashEntityRef;
                if (noteKind === "task") {
                    ref = { entityType: "note", noteKind: "task", projectId, taskId, noteId };
                } else if (noteKind === "chat") {
                    ref = {
                        entityType: "note",
                        noteKind: "chat",
                        chatType: chatType || "gm",
                        chatId,
                        threadId: threadId || "0",
                        noteId,
                    };
                } else if (noteKind === "shared") {
                    ref = { entityType: "note", noteKind: "shared", noteId };
                } else {
                    ref = { entityType: "note", noteKind: "my", noteId };
                }
                return (
                    <HashChip
                        href={entityRefToHref(ref)}
                        icon={chipIcon(StickyNote2RoundedIcon, NOTE_PALETTE)}
                        label={title || "note"}
                        palette={NOTE_PALETTE}
                    />
                );
            },
        }
    );

// Chat — GM only; chip shows "#<gm name>".
export const CreateHashChatSpec = () =>
    createReactInlineContentSpec(
        {
            type: "hashChat",
            propSchema: {
                chatId: { default: "" },
                chatName: { default: "" },
            },
            content: "none",
        },
        {
            render: (props) => {
                const { chatId, chatName } = props.inlineContent.props;
                const href = entityRefToHref({ entityType: "chat", chatType: "gm", chatId });
                return (
                    <HashChip
                        href={href}
                        icon={chipIcon(ForumRoundedIcon, CHAT_PALETTE)}
                        label={chatName || "chat"}
                        palette={CHAT_PALETTE}
                    />
                );
            },
        }
    );

// Project — chip shows "#<project name>".
export const CreateHashProjectSpec = () =>
    createReactInlineContentSpec(
        {
            type: "hashProject",
            propSchema: {
                projectId: { default: "" },
                projectName: { default: "" },
            },
            content: "none",
        },
        {
            render: (props) => {
                const { projectId, projectName } = props.inlineContent.props;
                const href = entityRefToHref({ entityType: "project", projectId });
                return (
                    <HashChip
                        href={href}
                        icon={chipIcon(FolderRoundedIcon, PROJECT_PALETTE)}
                        label={projectName || "project"}
                        palette={PROJECT_PALETTE}
                    />
                );
            },
        }
    );

// ── Suggestion menu ─────────────────────────────────────────────────────

// A two-line menu row mirroring the `@` menu's layout: a colored icon
// disc, a bold name, and a muted subtitle (the entity kind / id).
const menuRow = (
    Icon: typeof TaskAltRoundedIcon,
    palette: MentionPalette,
    name: string,
    subtitle: string
): ReactElement => (
    <Box alignItems="center" display="flex" gap={1} sx={{ minWidth: 0, width: "100%" }}>
        <Box
            sx={{
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: "8px",
                background: palette.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Icon sx={{ fontSize: 18, color: palette.text }} />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
            <Typography
                level="body-sm"
                sx={{
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                #{name}
            </Typography>
            <Typography
                level="body-xs"
                sx={{
                    opacity: 0.7,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                }}
            >
                {subtitle}
            </Typography>
        </Box>
    </Box>
);

// Per-editor cache of the built menu items. `HashMentionMenuItems` runs on
// every keystroke (BlockNote's `getItems`); without this, each character
// would re-merge four lists and re-instantiate every row's JSX. Keyed by
// `editor` (WeakMap auto-frees on gc); a hit requires all four source
// arrays to be reference-equal, which holds in steady state because the
// App-level provider value is memoized. Same pattern as `Mention.tsx`.
interface HashMenuCacheEntry {
    tasks: TaskTableProps[];
    notes: HashNoteEntry[];
    chats: AllChatProps[];
    projects: ProjectProps[];
    items: DefaultReactSuggestionItem[];
}
const _hashMenuCache = new WeakMap<object, HashMenuCacheEntry>();

// Builds the merged `#` suggestion list across tasks, notes, GM chats, and
// projects. `title` + `aliases` are set so a task matches on either its
// preview id or its title; the visible row lives entirely in `icon` (the
// custom `MentionSuggestionMenu` renders only that).
export const HashMentionMenuItems = (
    editor: any,
    data: HashMentionData
): DefaultReactSuggestionItem[] => {
    const cached = _hashMenuCache.get(editor);
    if (
        cached &&
        cached.tasks === data.tasks &&
        cached.notes === data.notes &&
        cached.chats === data.chats &&
        cached.projects === data.projects
    ) {
        return cached.items;
    }

    const taskItems: DefaultReactSuggestionItem[] = data.tasks
        .filter((t) => t.id != null && t.projectId != null)
        .map((t) => {
            const projectId = String(t.projectId);
            const taskId = String(t.id);
            const displayId = t.displayId || taskId;
            const title = t.title || "";
            return {
                title: displayId,
                aliases: title ? [title] : [],
                onItemClick: () => {
                    editor.insertInlineContent([
                        {
                            type: "hashTask",
                            props: { projectId, taskId, displayId: t.displayId || "", title },
                        },
                        " ",
                    ]);
                },
                icon: menuRow(
                    TaskAltRoundedIcon,
                    TASK_PALETTE,
                    title || displayId,
                    `Task · ${displayId}`
                ),
            };
        });

    const noteItems: DefaultReactSuggestionItem[] = data.notes
        .filter((n) => n.noteId != null)
        .map((n) => {
            const noteId = String(n.noteId);
            const title = n.title || "";
            // Per-kind ids; non-applicable kinds keep the schema defaults.
            const props: Record<string, string> = {
                noteKind: n.kind,
                noteId,
                title,
                projectId: "",
                taskId: "",
                chatType: "",
                chatId: "",
                threadId: "0",
            };
            let subtitle = "Note";
            if (n.kind === "task") {
                props.projectId = String(n.projectId ?? "");
                props.taskId = String(n.taskId ?? "");
                subtitle = "Task note";
            } else if (n.kind === "chat") {
                props.chatType = chatTypeCodeToSlug(n.chatType);
                props.chatId = String(n.chatId ?? "");
                props.threadId = String(n.threadId ?? "0");
                subtitle = "Chat note";
            } else if (n.kind === "shared") {
                subtitle = "Shared note";
            } else {
                subtitle = "My note";
            }
            return {
                title: title || "note",
                onItemClick: () => {
                    editor.insertInlineContent([{ type: "hashNote", props }, " "]);
                },
                icon: menuRow(StickyNote2RoundedIcon, NOTE_PALETTE, title || "note", subtitle),
            };
        });

    const chatItems: DefaultReactSuggestionItem[] = data.chats
        .filter((c) => c.chatId)
        .map((c) => {
            const chatId = String(c.chatId);
            const chatName = c.chatName || "";
            return {
                title: chatName || "chat",
                onItemClick: () => {
                    editor.insertInlineContent([
                        { type: "hashChat", props: { chatId, chatName } },
                        " ",
                    ]);
                },
                icon: menuRow(ForumRoundedIcon, CHAT_PALETTE, chatName || "chat", "Group chat"),
            };
        });

    const projectItems: DefaultReactSuggestionItem[] = data.projects
        .filter((p) => p.projectId != null)
        .map((p) => {
            const projectId = String(p.projectId);
            const projectName = p.projectName || "";
            return {
                title: projectName || "project",
                onItemClick: () => {
                    editor.insertInlineContent([
                        { type: "hashProject", props: { projectId, projectName } },
                        " ",
                    ]);
                },
                icon: menuRow(
                    FolderRoundedIcon,
                    PROJECT_PALETTE,
                    projectName || "project",
                    "Project"
                ),
            };
        });

    const items = [...taskItems, ...noteItems, ...chatItems, ...projectItems];
    _hashMenuCache.set(editor, {
        tasks: data.tasks,
        notes: data.notes,
        chats: data.chats,
        projects: data.projects,
        items,
    });
    return items;
};

// Drop-in `#` suggestion controller. Reads the entity lists from context
// (so editors don't prop-drill them) and reuses the `@` menu's custom
// popup. `minQueryLength={1}` keeps the popup hidden for a bare "#"/"# ",
// so BlockNote's Markdown heading shortcut ("# " → H1 at line start) keeps
// working; the menu only appears once a non-space query character follows.
// `filterAndRankSuggestionItems` strictly narrows to substring matches and
// floats the exact match to the top.
export const HashSuggestionMenuController = ({ editor }: { editor: any }) => {
    const data = useHashMentionData();
    return (
        <SuggestionMenuController
            minQueryLength={1}
            suggestionMenuComponent={MentionSuggestionMenu}
            triggerCharacter={"#"}
            getItems={async (query) =>
                filterAndRankSuggestionItems(HashMentionMenuItems(editor, data), query)
            }
        />
    );
};
