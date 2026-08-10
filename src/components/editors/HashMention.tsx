import { ReactElement } from "react";
import {
    createReactInlineContentSpec,
    DefaultReactSuggestionItem,
    SuggestionMenuController,
} from "@blocknote/react";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
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
import { TaskMentionHoverCard } from "../../features/tasks/components/TaskMentionHoverCard";
import { TaskStatusChip } from "../../features/tasks/components/TaskStatusChip";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { fmt, getMessages } from "../../i18n";
import { AllChatProps } from "../../types/chat";
import { ProjectProps, SearchTeamTasksResponse, TaskTableProps } from "../../types/tasks";
import { chatTypeCodeToSlug, entityRefToHref, HashEntityRef } from "../../utils/entityHref";
import { filterAndRankSuggestionItems } from "../../utils/suggestionRanking";
import { AppTooltip } from "../ui/AppTooltip";
import { MentionPalette, MentionSuggestionMenu } from "./Mention";

// Sibling palettes to the `@` user/group chips (see `mentionChipSx`). One
// per entity type so a `#` reference reads at a glance as task vs note vs
// chat vs project.
// Exported so the plain-DOM light path (`LightMessageBody`) renders `#`
// chips with the identical per-entity colors instead of duplicating them.
export const TASK_PALETTE: MentionPalette = {
    bg: "rgba(59, 130, 246, 0.15)",
    bgHover: "rgba(59, 130, 246, 0.28)",
    text: "#2563eb",
};
// Milestone rows read as their own kind, not a task — the orange
// milestone identity color used across the app (task table flag icon,
// diagram node, Spotlight milestone chip) so a `#` milestone suggestion
// matches the milestone's colour everywhere else.
export const MILESTONE_PALETTE: MentionPalette = {
    bg: "rgba(249, 115, 22, 0.15)",
    bgHover: "rgba(249, 115, 22, 0.28)",
    text: "#ea580c",
};
export const NOTE_PALETTE: MentionPalette = {
    bg: "rgba(var(--gp-brandalt-500-rgb), 0.15)",
    bgHover: "rgba(var(--gp-brandalt-500-rgb), 0.28)",
    text: "var(--gp-brand-700)",
};
export const CHAT_PALETTE: MentionPalette = {
    bg: "rgba(20, 184, 166, 0.15)",
    bgHover: "rgba(20, 184, 166, 0.28)",
    text: "#0d9488",
};
export const PROJECT_PALETTE: MentionPalette = {
    bg: "rgba(245, 158, 11, 0.15)",
    bgHover: "rgba(245, 158, 11, 0.28)",
    text: "#d97706",
};

// `#` mentions render as styled inline TEXT — NOT a chip/pill — so they read
// as a distinct affordance from the `@` user/group mention chips (which keep
// their colored pills). Per-entity color is the type cue (task=blue,
// note=violet, chat=teal, project=amber); a faded underline (stronger on
// hover) marks it as clickable. Clicking hands the rebuilt href to the
// URL-link modal; `useUrlLinkModal` is null outside the provider (pre-auth)
// so the click no-ops gracefully.
//
// NOTE: where a Tooltip wraps the chip (the task mention), anchor it on a
// plain <span>, not on this component directly — Joy's Tooltip clones its
// child and injects props (incl. a stray `component`) that clobber the
// styled Box.
// Exported so the light path shares this exact style (see the palette
// comment above).
export const hashMentionTextSx = (palette: MentionPalette) =>
    ({
        display: "inline",
        color: palette.text,
        fontWeight: 600,
        cursor: "pointer",
        // A subtle, faded underline marks it as a distinct interactive token
        // (vs plain text) without the weight of a chip/pill; it strengthens
        // on hover.
        textDecoration: "underline",
        textDecorationColor: palette.bgHover,
        textUnderlineOffset: "2px",
        transition: "text-decoration-color 0.15s ease",
        "&:hover": { textDecorationColor: palette.text },
    }) as const;

const HashChip = ({
    href,
    label,
    palette,
}: {
    href: string;
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
        <Box sx={hashMentionTextSx(palette)} onClick={handleClick}>
            #{label}
        </Box>
    );
};

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
                    <AppTooltip
                        enterDelay={250}
                        placement="top-start"
                        surface="none"
                        title={
                            <TaskMentionHoverCard
                                displayId={idText}
                                projectId={projectId}
                                taskId={taskId}
                                title={title}
                            />
                        }
                    >
                        {/* Plain <span> anchor: Joy's Tooltip clones its child
                            and injects props (ref, hover handlers, a stray
                            `component`) — landing them on the styled chip
                            dropped its styling, so anchor on a bare span and
                            keep the HashChip inside untouched. */}
                        <span>
                            <HashChip href={href} label={label} palette={TASK_PALETTE} />
                        </span>
                    </AppTooltip>
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
                const copy = getMessages().common.editor;
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
                } else if (noteKind === "team") {
                    ref = { entityType: "note", noteKind: "team", noteId };
                } else {
                    ref = { entityType: "note", noteKind: "my", noteId };
                }
                return (
                    <HashChip
                        href={entityRefToHref(ref)}
                        label={title || copy.hashNoteFallback}
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
                const copy = getMessages().common.editor;
                const { chatId, chatName } = props.inlineContent.props;
                const href = entityRefToHref({ entityType: "chat", chatType: "gm", chatId });
                return (
                    <HashChip
                        href={href}
                        label={chatName || copy.hashChatFallback}
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
                const copy = getMessages().common.editor;
                const { projectId, projectName } = props.inlineContent.props;
                const href = entityRefToHref({ entityType: "project", projectId });
                return (
                    <HashChip
                        href={href}
                        label={projectName || copy.hashProjectFallback}
                        palette={PROJECT_PALETTE}
                    />
                );
            },
        }
    );

// ── Suggestion menu ─────────────────────────────────────────────────────

// A two-line menu row mirroring the `@` menu's layout: a colored icon
// disc, a bold name, and a muted subtitle (the entity kind / id).
//
// `trailing` is an optional right-aligned slot — task rows put their
// status chip there. It sits OUTSIDE the name/subtitle column so the
// title keeps ellipsizing against the remaining width rather than being
// pushed out by the chip.
const menuRow = (
    Icon: typeof TaskAltRoundedIcon,
    palette: MentionPalette,
    name: string,
    subtitle: string,
    trailing?: ReactElement | null
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
        {trailing}
    </Box>
);

// Per-editor cache of the built menu items. `HashMentionMenuItems` runs on
// every keystroke (BlockNote's `getItems`); without this, each character
// would re-merge four lists and re-instantiate every row's JSX. Keyed by
// `editor` (WeakMap auto-frees on gc); a hit requires all four source
// arrays to be reference-equal, which holds in steady state because the
// App-level provider value is memoized. Same pattern as `Mention.tsx`.
/** What a task needs to become a `#` row, from either source. */
type MentionableTask = {
    projectId: string;
    taskId: string;
    displayId: string;
    title: string;
    projectName: string;
    // Status label ("Open" / "WIP" / "Blocked" / …), rendered as the
    // row's trailing chip. The two sources disagree on shape — the open
    // project's table rows carry a bare string, the team search carries
    // a `TaskStatusProps` object — so both are normalized to the label
    // here. Empty string when unknown; the row then renders no chip
    // rather than a misleading "Open".
    status: string;
    // True when this row's backing task IS a milestone. A milestone is
    // technically a task (same id, same `hashTask` chip on insert), but
    // the suggestion row must READ as a milestone — its own icon, colour
    // and subtitle — so the user isn't offered "milestone" mislabelled
    // as "task". Both sources carry the flag.
    isMilestone: boolean;
};

interface HashMenuCacheEntry {
    tasks: TaskTableProps[];
    teamTasks: SearchTeamTasksResponse[];
    notes: HashNoteEntry[];
    chats: AllChatProps[];
    projects: ProjectProps[];
    copy: ReturnType<typeof getMessages>["common"]["editor"];
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
    const copy = getMessages().common.editor;
    const cached = _hashMenuCache.get(editor);
    if (
        cached &&
        cached.tasks === data.tasks &&
        cached.teamTasks === data.teamTasks &&
        cached.notes === data.notes &&
        cached.chats === data.chats &&
        cached.projects === data.projects &&
        cached.copy === copy
    ) {
        return cached.items;
    }

    // Two task sources, deduped by project+task id: the OPEN project's
    // table rows (instant — an optimistic create shows before any refetch)
    // and the team-wide search list (every project, so `#` isn't confined
    // to whichever project happens to be open). Open-project rows win the
    // dedupe: same task, but that copy is the fresher of the two.
    //
    // The row's project name comes from the project list where possible
    // (one lookup, always current) and from the search row otherwise. Now
    // that the menu spans projects, it's the only thing separating two
    // same-named tasks in different projects.
    const projectNameById = new Map<string, string>(
        data.projects
            .filter((p) => p.projectId != null)
            .map((p) => [String(p.projectId), p.projectName || ""])
    );
    const taskRows: MentionableTask[] = [
        ...data.tasks
            .filter((t) => t.id != null && t.projectId != null)
            .map((t) => ({
                projectId: String(t.projectId),
                taskId: String(t.id),
                displayId: t.displayId || "",
                title: t.title || "",
                projectName: projectNameById.get(String(t.projectId)) || "",
                status: t.status || "",
                isMilestone: Boolean(t.isMilestone),
            })),
        ...data.teamTasks
            .filter((t) => t.taskId != null && t.projectId != null)
            .map((t) => ({
                projectId: String(t.projectId),
                taskId: String(t.taskId),
                displayId: t.displayId || "",
                title: t.title || "",
                projectName: projectNameById.get(String(t.projectId)) || t.projectName || "",
                status: t.status?.status || "",
                isMilestone: Boolean(t.isMilestone),
            })),
    ];
    const seenTaskKeys = new Set<string>();
    const taskItems: DefaultReactSuggestionItem[] = taskRows
        .filter((t) => {
            const key = `${t.projectId}-${t.taskId}`;
            if (seenTaskKeys.has(key)) return false;
            seenTaskKeys.add(key);
            return true;
        })
        .map((t) => {
            const { projectId, taskId } = t;
            const displayId = t.displayId || taskId;
            const title = t.title;
            // A milestone is a task under the hood (it inserts the same
            // `hashTask` chip and deep-links the same way), but its
            // suggestion row wears the milestone icon, colour and
            // subtitle so it doesn't read as a plain task.
            const projectTpl = t.isMilestone ? copy.hashMilestoneProject : copy.hashTaskProject;
            const plainTpl = t.isMilestone ? copy.hashMilestone : copy.hashTask;
            return {
                title: displayId,
                aliases: title ? [title] : [],
                onItemClick: () => {
                    editor.insertInlineContent([
                        {
                            type: "hashTask",
                            props: { projectId, taskId, displayId: t.displayId, title },
                        },
                        " ",
                    ]);
                },
                icon: menuRow(
                    t.isMilestone ? FlagRoundedIcon : TaskAltRoundedIcon,
                    t.isMilestone ? MILESTONE_PALETTE : TASK_PALETTE,
                    title || displayId,
                    t.projectName
                        ? fmt(projectTpl, {
                              id: displayId,
                              project: t.projectName,
                          })
                        : fmt(plainTpl, { id: displayId }),
                    // The canonical dashboard status chip, so a status
                    // reads identically here and in the task surfaces.
                    t.status ? <TaskStatusChip iconSize={11} status={t.status} /> : null
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
            let subtitle: string = copy.hashNote;
            if (n.kind === "task") {
                props.projectId = String(n.projectId ?? "");
                props.taskId = String(n.taskId ?? "");
                subtitle = copy.hashTaskNote;
            } else if (n.kind === "chat") {
                props.chatType = chatTypeCodeToSlug(n.chatType);
                props.chatId = String(n.chatId ?? "");
                props.threadId = String(n.threadId ?? "0");
                subtitle = copy.hashChatNote;
            } else if (n.kind === "shared") {
                subtitle = copy.hashSharedNote;
            } else if (n.kind === "team") {
                subtitle = copy.hashTeamNote;
            } else {
                subtitle = copy.hashMyNote;
            }
            return {
                title: title || copy.hashNoteFallback,
                onItemClick: () => {
                    editor.insertInlineContent([{ type: "hashNote", props }, " "]);
                },
                icon: menuRow(
                    StickyNote2RoundedIcon,
                    NOTE_PALETTE,
                    title || copy.hashNoteFallback,
                    subtitle
                ),
            };
        });

    const chatItems: DefaultReactSuggestionItem[] = data.chats
        .filter((c) => c.chatId)
        .map((c) => {
            const chatId = String(c.chatId);
            const chatName = c.chatName || "";
            return {
                title: chatName || copy.hashChatFallback,
                onItemClick: () => {
                    editor.insertInlineContent([
                        { type: "hashChat", props: { chatId, chatName } },
                        " ",
                    ]);
                },
                icon: menuRow(
                    ForumRoundedIcon,
                    CHAT_PALETTE,
                    chatName || copy.hashChatFallback,
                    copy.hashGroupChat
                ),
            };
        });

    const projectItems: DefaultReactSuggestionItem[] = data.projects
        .filter((p) => p.projectId != null)
        .map((p) => {
            const projectId = String(p.projectId);
            const projectName = p.projectName || "";
            return {
                title: projectName || copy.hashProjectFallback,
                onItemClick: () => {
                    editor.insertInlineContent([
                        { type: "hashProject", props: { projectId, projectName } },
                        " ",
                    ]);
                },
                icon: menuRow(
                    FolderRoundedIcon,
                    PROJECT_PALETTE,
                    projectName || copy.hashProjectFallback,
                    copy.hashProject
                ),
            };
        });

    const items = [...taskItems, ...noteItems, ...chatItems, ...projectItems];
    _hashMenuCache.set(editor, {
        tasks: data.tasks,
        teamTasks: data.teamTasks,
        notes: data.notes,
        chats: data.chats,
        projects: data.projects,
        copy,
        items,
    });
    return items;
};

// Drop-in `#` suggestion controller. Reads the entity lists from context
// (so editors don't prop-drill them) and reuses the `@` menu's custom
// popup. `minQueryLength={2}` keeps the popup hidden for a bare "#"/"# "
// — so BlockNote's Markdown heading shortcut ("# " → H1 at line start)
// keeps working — and for a single character, where one letter matches
// most of the workspace and the menu is noise rather than help. Matches
// the `:` emoji menu's threshold.
// `filterAndRankSuggestionItems` strictly narrows to substring matches and
// floats the exact match to the top.
export const HashSuggestionMenuController = ({ editor }: { editor: any }) => {
    const data = useHashMentionData();
    return (
        <SuggestionMenuController
            minQueryLength={2}
            suggestionMenuComponent={MentionSuggestionMenu}
            triggerCharacter={"#"}
            getItems={async (query) => {
                // Kick a (throttled, app-wide) re-pull of the backing
                // lists: note metadata and the project list are otherwise
                // loaded once per page load, so a teammate's note was
                // missing here until a reload.
                //
                // Deliberately NOT awaited. `data` is this render's
                // closure, and BlockNote only re-runs `getItems` when the
                // QUERY changes — awaiting would add a network beat to
                // menu-open latency and still return the old list. Firing
                // it here means the fetch lands while the user is still
                // typing the name, so the next keystroke shows the item.
                data.refresh();
                return filterAndRankSuggestionItems(HashMentionMenuItems(editor, data), query);
            }}
        />
    );
};
