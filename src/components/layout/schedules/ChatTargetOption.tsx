// One place a schedule can post its report, drawn the way the Project updates picker draws a
// project (MIP-2347): its picture, what kind of place it is, and its tags, so two chats called
// "Design" can be told apart. The same row is the dropdown option and, as the decorator, the
// avatar in the closed field.
//
//   Inbox          an inbox glyph and "My Inbox"
//   Project chat   the project's row (`ProjectIdentityRow`: avatar, labels, lock, name)
//   Group chat     the chat's picture and the member's OWN tags on it (private, client-side only)
//
// Presentational: the picker owns selection. Every list is read from what the app already holds
// (the `#` mention data and the personal-tag store): this makes no request.

import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { Box, Typography } from "@mui/joy";

import { BaseAvatar } from "../../../components/ui/avatars/BaseAvatar";
import { GroupChatAvatar, ProjectChatAvatar } from "../../../components/ui/avatars/ChatKindAvatar";
import { useHashMentionData } from "../../../context/HashMentionDataContext";
import {
    ProjectIdentityRow,
    type ProjectIdentity,
} from "../../../features/tasks/components/ProjectIdentityRow";
import { usePersonalGMTags } from "../../../hooks/common/personalGMTagsState";
import { useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { MAX_TARGET_TAGS, useChatTargetAvatar, type DeliverTarget } from "./chatTarget";

const InboxMark = () => (
    <BaseAvatar size="xs">
        <InboxOutlinedIcon sx={{ fontSize: 14, color: g.text.tertiary }} />
    </BaseAvatar>
);

/** The member's own tags on a group chat, at most `max`, then "+N". Nothing while the store
 *  loads or when the chat has none, so an untagged row keeps its plain geometry. */
const PersonalTagChips = ({ chatId, max }: { chatId: string; max: number }) => {
    const { loaded, tags, assignmentsByChannelId } = usePersonalGMTags();
    const ids = assignmentsByChannelId[chatId];
    if (!loaded || !ids || ids.length === 0) return null;
    const byId = new Map(tags.map((tag) => [tag.tagId, tag]));
    const mine = ids.flatMap((id) => byId.get(id) ?? []);
    if (mine.length === 0) return null;
    const shown = mine.slice(0, max);
    const overflow = mine.length - shown.length;
    return (
        <Box
            data-testid="chat-target-tags"
            sx={{ display: "flex", alignItems: "center", gap: 0.375, minWidth: 0 }}
            title={mine.map((tag) => tag.name).join(", ")}
        >
            {shown.map((tag) => (
                <Box
                    key={tag.tagId}
                    sx={{
                        alignItems: "center",
                        background: `color-mix(in srgb, ${tag.color} 12%, transparent)`,
                        border: "1px solid",
                        borderColor: `${tag.color}35`,
                        borderRadius: "5px",
                        color: tag.color,
                        display: "inline-flex",
                        flexShrink: 0,
                        fontSize: "0.625rem",
                        fontWeight: 600,
                        height: 16,
                        lineHeight: 1,
                        maxWidth: 84,
                        overflow: "hidden",
                        px: 0.75,
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {tag.name}
                </Box>
            ))}
            {overflow > 0 && (
                <Box
                    sx={{
                        alignItems: "center",
                        border: "1px solid",
                        borderColor: g.border.default,
                        borderRadius: "5px",
                        color: g.text.tertiary,
                        display: "inline-flex",
                        flexShrink: 0,
                        fontSize: "0.625rem",
                        fontWeight: 600,
                        height: 16,
                        lineHeight: 1,
                        px: 0.75,
                    }}
                >
                    +{overflow}
                </Box>
            )}
        </Box>
    );
};

const Name = ({ children, muted = false }: { children: string; muted?: boolean }) => (
    <Typography
        level="body-sm"
        sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 500,
            color: muted ? g.text.tertiary : "inherit",
        }}
        noWrap
    >
        {children}
    </Typography>
);

// The kind ("Group chat" / "Project chat") beside the name. At phone width the row has no room
// for it without cutting the names to a letter or two, so it stays for screen readers only
// there: the picture and the chips tell the kinds apart, and the closed field shows the name.
const visuallyHiddenOnPhone = {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
} as const;

const Kind = ({ children }: { children: string }) => (
    <Typography
        level="body-xs"
        sx={{
            flexShrink: 0,
            color: g.text.tertiary,
            fontWeight: 400,
            ...visuallyHiddenOnPhone,
            "@media (min-width: 600px)": {
                position: "static",
                width: "auto",
                height: "auto",
                overflow: "visible",
                clip: "auto",
            },
        }}
        noWrap
    >
        {children}
    </Typography>
);

const TargetAvatar = ({ target }: { target: DeliverTarget }) => {
    const src = useChatTargetAvatar(target);
    if (target.kind === "inbox") return <InboxMark />;
    return target.kind === "project" ? (
        <ProjectChatAvatar size="xs" src={src} />
    ) : (
        <GroupChatAvatar size="xs" src={src} />
    );
};

const AllChatsMark = () => (
    <BaseAvatar size="xs">
        <ForumOutlinedIcon sx={{ fontSize: 14, color: g.text.tertiary }} />
    </BaseAvatar>
);

/** The closed field's start decorator: the picture, nothing else (the input holds the name).
 *  `allLabel`: the empty row means "every chat" (the catch-up's picker), not the Inbox. */
export const ChatTargetDecorator = ({
    target,
    allLabel,
}: {
    target: DeliverTarget;
    allLabel?: string;
}) => (allLabel && target.kind === "inbox" ? <AllChatsMark /> : <TargetAvatar target={target} />);

/**
 * The row. `unavailable` is the stand-in for a saved place the member can no longer be offered
 * (archived, left): its name is muted and it carries no kind or tags, as the project picker's
 * "(unavailable)" row does.
 */
export const ChatTargetOption = ({
    target,
    unavailable = false,
    allLabel,
}: {
    target: DeliverTarget;
    unavailable?: boolean;
    /** The empty row's words when it means "every chat" rather than the Inbox. */
    allLabel?: string;
}) => {
    const { t } = useTranslation();
    const s = t.settings.schedules;
    const { projects } = useHashMentionData();
    const avatarSrc = useChatTargetAvatar(target);

    if (target.kind === "inbox" && allLabel) {
        return (
            <>
                <AllChatsMark />
                <Name>{allLabel}</Name>
            </>
        );
    }
    if (target.kind === "inbox") {
        return (
            <>
                <InboxMark />
                <Name>{s.deliverInbox}</Name>
            </>
        );
    }
    if (unavailable) {
        return (
            <>
                <TargetAvatar target={target} />
                <Name muted>{target.title || s.unavailable}</Name>
            </>
        );
    }
    if (target.kind === "project") {
        const project: ProjectIdentity | undefined = projects.find(
            (p) => p.projectId === target.projectId
        );
        return (
            <>
                {project ? (
                    <ProjectIdentityRow
                        avatarSrc={avatarSrc}
                        maxLabels={MAX_TARGET_TAGS}
                        project={{ ...project, projectName: target.title || project.projectName }}
                    />
                ) : (
                    <>
                        <TargetAvatar target={target} />
                        <Name>{target.title}</Name>
                    </>
                )}
                <Kind>{s.deliverKindProject}</Kind>
            </>
        );
    }
    return (
        <>
            <TargetAvatar target={target} />
            <PersonalTagChips chatId={target.id} max={MAX_TARGET_TAGS} />
            <Name>{target.title}</Name>
            <Kind>{s.deliverKindGroup}</Kind>
        </>
    );
};
