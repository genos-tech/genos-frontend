import { lazy, Suspense, useState } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { MessageBody } from "../../../components/messageBody/MessageBody";
import { EmojiText } from "../../../components/ui/emoji/EmojiText";
import { useAuth } from "../../../context/AuthContext";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../../hooks/common/UrlLinkModalContext";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { fmt, getMessages, useTranslation } from "../../../i18n";
import { purplePalette } from "../../../theme/purplePalette";
import { UserProps } from "../../../types/admin";
import { InboxItemProps } from "../../../types/common";
import { extractYYYYMMDD, extractYYYYMMDDHHMM } from "../../../utils/dateUtils";
import { addInboxItem } from "../../admin/services/addInboxItem";
import { respondToOwnershipClaim } from "../../admin/services/ownershipClaim";
import {
    respondToExternalShare,
    respondToTeamConnection,
} from "../../admin/services/teamConnections";
import { isActivityItemType } from "../utils/inboxItemTypes";
import { DigestHeadline } from "./DigestHeadline";
import { InboxCrossTeamChips } from "./InboxCrossTeamChips";
import { InboxTargetChip } from "./InboxTargetChip";

// Lazy: keeps react-markdown (and its remark deps) out of the inbox's
// initial chunk — only digest bubbles ever need it.
const DigestBody = lazy(() => import("./DigestBody"));

// Item type configurations for cleaner code. `colorScheme` is intentionally
// NOT mapped to the unified purple palette — each request type needs a
// distinct hue (Team=blue, Project=green, GM=pink, Note=amber) so the user
// can tell request types apart at a glance in a dense inbox.
type RequestLabelKey =
    | "teamRequest"
    | "projectRequest"
    | "gmRequest"
    | "noteAccessRequest"
    | "ownershipClaim"
    | "digest"
    | "teamConnection"
    | "externalShare"
    | "messageReminder";

const ITEM_TYPE_CONFIG: Record<
    number,
    {
        labelKey: RequestLabelKey;
        icon: React.ReactNode;
        // Types 1-4 answer over Socket.IO. Type 5 (ownership claim) is
        // HTTP — its guards live in a locked Django transaction — so it
        // carries no events and is dispatched separately below.
        approveEvent?: string;
        rejectEvent?: string;
        colorScheme: { dark: string; light: string };
    }
> = {
    1: {
        labelKey: "teamRequest",
        icon: <GroupsRoundedIcon sx={{ fontSize: 14 }} />,
        approveEvent: "approve_join_team_request",
        rejectEvent: "reject_join_team_request",
        colorScheme: { dark: "#60a5fa", light: "#3b82f6" },
    },
    2: {
        labelKey: "projectRequest",
        icon: <FolderRoundedIcon sx={{ fontSize: 14 }} />,
        approveEvent: "approve_join_project_request",
        rejectEvent: "reject_join_project_request",
        colorScheme: { dark: "#4ade80", light: "#22c55e" },
    },
    3: {
        labelKey: "gmRequest",
        icon: <ChatRoundedIcon sx={{ fontSize: 14 }} />,
        approveEvent: "approve_join_gm_request",
        rejectEvent: "reject_join_gm_request",
        colorScheme: { dark: "#f472b6", light: "#ec4899" },
    },
    4: {
        labelKey: "noteAccessRequest",
        icon: <StickyNote2RoundedIcon sx={{ fontSize: 14 }} />,
        approveEvent: "approve_note_access_request",
        rejectEvent: "reject_note_access_request",
        colorScheme: { dark: "#fbbf24", light: "#f59e0b" },
    },
    // Red, alone among the request types, and deliberately so: this is
    // the only inbox item that costs you something by being IGNORED.
    5: {
        labelKey: "ownershipClaim",
        icon: <ShieldRoundedIcon sx={{ fontSize: 14 }} />,
        colorScheme: { dark: "#f87171", light: "#ef4444" },
    },
    // Proactive Genos digest (UX tier model §8): system-authored, not a
    // request — no approve/reject events, body rendered from
    // item_body.{title,text} below rather than BlockNote blocks.
    6: {
        labelKey: "digest",
        icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />,
        colorScheme: { dark: "#c084fc", light: "#9333ea" },
    },
    // Cross-team sharing (7, 8). Teal, apart from the in-team request
    // hues above, because the thing that matters about these two is that
    // the other party is a different ORGANIZATION — the distinction worth
    // seeing before you read a word of the card. Answered over HTTP, like
    // the ownership claim, so they carry no socket events.
    7: {
        labelKey: "teamConnection",
        icon: <HubRoundedIcon sx={{ fontSize: 14 }} />,
        colorScheme: { dark: "#2dd4bf", light: "#0d9488" },
    },
    8: {
        labelKey: "externalShare",
        icon: <ShareRoundedIcon sx={{ fontSize: 14 }} />,
        colorScheme: { dark: "#2dd4bf", light: "#0d9488" },
    },
    // A message reminder come due. Violet, matching the reminder chip in
    // the flagged list and the More menu — the same promise, kept.
    9: {
        labelKey: "messageReminder",
        icon: <NotificationsActiveRoundedIcon sx={{ fontSize: 14 }} />,
        colorScheme: { dark: "#c4b5fd", light: "#7c3aed" },
    },
};

/** `item_type` for a team-ownership claim. See `ownershipClaim.ts`. */
const OWNERSHIP_CLAIM = 5;

/** `item_type` for a proactive Genos digest (UX tier model §8). */
const DIGEST = 6;

/** `item_type`s for cross-team sharing. See `teamConnections.ts`. */
const TEAM_CONNECTION = 7;
const EXTERNAL_SHARE = 8;

/** `item_type` for a message reminder that came due. See
 *  `origin/services/message_reminders.py`. */
const MESSAGE_REMINDER = 9;

/** The request types answered over HTTP rather than a socket event. */
const HTTP_ANSWERED = [OWNERSHIP_CLAIM, TEAM_CONNECTION, EXTERNAL_SHARE];

// Where the card's body text actually starts, measured from the card's own
// content edge. The body is inset TWICE — MessageBody wraps it in a box with
// `px: var(--bn-preview-box-px)`, and `.inbox-preview-{light,dark} .bn-editor`
// then adds `var(--inbox-preview-indent)` on top.
//
// Chips sit BESIDE the preview, not inside it, so they have to clear both or
// they hang off to the left of the sentence they belong to. Summed with calc()
// rather than hard-coded, so tuning either inset keeps the chips aligned.
const BODY_TEXT_INDENT = "calc(var(--bn-preview-box-px) + var(--inbox-preview-indent))";

type InboxBubbleProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    inboxItem: InboxItemProps;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    /** Re-read the list after this card answers its own request. */
    onItemChanged?: () => void;
};

export const InboxBubble = (props: InboxBubbleProps) => {
    const { useTEM, socket, myself, setMyself, inboxItem, useUISM, useCM, onItemChanged } = props;
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const [localStatus, setLocalStatus] = useState<"approved" | "rejected" | null>(null);
    const [isHovered, setIsHovered] = useState<boolean>(false);
    // Only the HTTP paths can report a refusal — a socket emit is
    // fire-and-forget. Answering something you no longer have standing to
    // answer (a claim after ownership moved, a share the host withdrew)
    // has to say so, not no-op.
    const [respondError, setRespondError] = useState<string | null>(null);

    const config = ITEM_TYPE_CONFIG[inboxItem.itemType];
    // Anything that isn't an activity is something somebody is waiting on
    // an answer to. Asked as "not an activity" rather than as a numeric
    // range: an upper bound is how the two cross-team types shipped as
    // cards with no Approve button on a request that could not be answered
    // anywhere else in the product.
    const isRequest = !isActivityItemType(inboxItem.itemType);
    // Cards that can name an openable target: team/project/GM join requests
    // (1-3) and activities (0). Note-access (4) is excluded — it has its own
    // open-note chip. The chip renders nothing when nothing resolves, so this
    // gate only decides where it's worth looking.
    const canHaveTarget = inboxItem.itemType >= 0 && inboxItem.itemType <= 3;
    const resolvedStatus = localStatus ?? inboxItem.requestStatus;
    const isHandled = resolvedStatus === "approved" || resolvedStatus === "rejected";
    const claimDeadline =
        inboxItem.itemType === OWNERSHIP_CLAIM
            ? (inboxItem.itemOptionals?.deadline as string | undefined)
            : undefined;
    const isCrossTeam =
        inboxItem.itemType === TEAM_CONNECTION || inboxItem.itemType === EXTERNAL_SHARE;
    const crossTeamHint =
        inboxItem.itemType === TEAM_CONNECTION
            ? t.inbox.crossTeam.connectionHint
            : inboxItem.itemType === EXTERNAL_SHARE
              ? t.inbox.crossTeam.shareHint
              : null;
    // Where the accepted thing actually IS. Accepting a share admits the
    // approver and the object joins their own lists, but nothing said so —
    // the card went quiet and the only way to learn it had worked was to
    // go looking. This is the one sentence that closes that loop.
    const acceptedObjectType = String(inboxItem.itemOptionals?.object_type ?? "");
    const acceptedIn =
        inboxItem.itemType === EXTERNAL_SHARE && resolvedStatus === "approved"
            ? (t.inbox.crossTeam.acceptedIn[
                  acceptedObjectType as keyof typeof t.inbox.crossTeam.acceptedIn
              ] ?? null)
            : null;
    const labelSubtleColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
    // The cross-team types were first written with a digest-style
    // `{title, text}` body, which the BlockNote renderer below reads as an
    // empty document — the rows already filed that way would stay blank
    // cards forever. Read either shape rather than migrate them.
    const legacyBody =
        inboxItem.itemType !== DIGEST &&
        inboxItem.itemType !== MESSAGE_REMINDER &&
        !Array.isArray(inboxItem.itemBody)
            ? (inboxItem.itemBody as unknown as { title?: string; text?: string } | null)
            : null;
    const legacyText = legacyBody
        ? [legacyBody.title, legacyBody.text].filter(Boolean).join("\n")
        : "";

    // A reminder that came due (itemType 9). The card is composed from the
    // optionals rather than the stored `{title, text}` body: those facts are
    // language-free, so a reminder set in English still reads in Japanese,
    // and the preview can be quoted apart from the sentence about it.
    const reminderOptionals =
        inboxItem.itemType === MESSAGE_REMINDER ? inboxItem.itemOptionals : null;
    const reminderPreview = String(reminderOptionals?.preview ?? "");
    const reminderSender = String(reminderOptionals?.sender_name ?? "");
    const reminderHref = String(reminderOptionals?.href ?? "");
    const reminderChatName = String(reminderOptionals?.chat_name ?? "");

    // Note-access requests (itemType 4) can open the referenced note in the
    // URL-link modal. Only personal notes (note_type 1) are routable from
    // the stored optionals (note_type/note_id) — the my-notes URL needs just
    // the id, whereas task/chat notes need project/task/chat ids the request
    // doesn't carry, so they show no open affordance (a scoped follow-up).
    const urlLinkModal = useUrlLinkModal();
    const noteOptionals = inboxItem.itemType === 4 ? inboxItem.itemOptionals : null;
    const openableNote =
        noteOptionals && noteOptionals.note_type === 1 && noteOptionals.note_id
            ? {
                  href: `/workspace/notes/my/${noteOptionals.note_id}`,
                  title: noteOptionals.note_title || t.inbox.noteAccess.openNote,
              }
            : null;

    // Three request types are answered over HTTP rather than the socket
    // events types 1-4 use — the ownership claim, and both cross-team
    // ones, whose rules live in a Django transaction. Which endpoint is
    // decided by the type; what they have in common is everything after.
    const answerOverHttp = async (accept: boolean): Promise<boolean> => {
        const optionals = inboxItem.itemOptionals ?? {};
        if (inboxItem.itemType === OWNERSHIP_CLAIM) {
            return respondToOwnershipClaim(
                accessToken,
                inboxItem.itemId,
                accept ? "approve" : "reject",
                setRespondError
            );
        }
        if (inboxItem.itemType === TEAM_CONNECTION) {
            const connectionId = optionals.connection_id as string | undefined;
            if (!connectionId) {
                setRespondError(t.inbox.crossTeam.failed);
                return false;
            }
            return respondToTeamConnection(accessToken, connectionId, accept, setRespondError);
        }
        const grantId = optionals.grant_id as string | undefined;
        if (!grantId) {
            setRespondError(t.inbox.crossTeam.failed);
            return false;
        }
        return respondToExternalShare(accessToken, grantId, accept, setRespondError);
    };

    // The optimistic `setLocalStatus` only moves once the call resolves —
    // unlike a socket emit, these can be refused (you may no longer be the
    // owner; the other team may have withdrawn the offer), and showing
    // "Approved" on a request the server rejected would be a lie about
    // what access exists.
    const respondOverHttp = async (accept: boolean) => {
        setRespondError(null);
        if (!(await answerOverHttp(accept))) return;
        const status = accept ? "approved" : "rejected";
        setLocalStatus(status);
        // PERSIST IT, don't just flip local state. These rows render
        // inside a Virtuoso list, so component state dies whenever a row
        // is recycled — and the stored item still said "pending", so the
        // card came back with Approve/Reject live on a request that had
        // already been answered. Types 1-4 avoid this for free: they
        // answer over Socket.IO and the service pushes the updated card
        // back, which writes to IndexedDB and re-reads the list. These
        // answer over HTTP, so they have to do both themselves.
        await addInboxItem({ ...inboxItem, requestStatus: status, isRead: true });
        onItemChanged?.();
    };

    const handleApprove = () => {
        if (HTTP_ANSWERED.includes(inboxItem.itemType)) {
            void respondOverHttp(true);
        } else if (socket && config?.approveEvent) {
            socket.emit(config.approveEvent, { item_id: inboxItem.itemId });
            setLocalStatus("approved");
        }
    };

    const handleReject = () => {
        if (HTTP_ANSWERED.includes(inboxItem.itemType)) {
            void respondOverHttp(false);
        } else if (socket && config?.rejectEvent) {
            socket.emit(config.rejectEvent, { item_id: inboxItem.itemId });
            setLocalStatus("rejected");
        }
    };

    return (
        <Card
            variant="outlined"
            sx={{
                p: { xs: 1.5, md: 2 },
                background: isDark
                    ? isHovered
                        ? "linear-gradient(135deg, rgba(35,35,45,0.95) 0%, rgba(30,30,40,0.98) 100%)"
                        : "linear-gradient(135deg, rgba(28,28,35,0.9) 0%, rgba(24,24,30,0.95) 100%)"
                    : isHovered
                      ? "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(250,250,255,1) 100%)"
                      : "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(252,252,255,1) 100%)",
                border: "1px solid",
                borderColor: isHovered
                    ? isDark
                        ? "rgba(var(--gp-brandalt-500-rgb), 0.25)"
                        : "rgba(var(--gp-brand-700-rgb), 0.15)"
                    : isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.06)",
                borderRadius: "14px",
                boxShadow: isHovered
                    ? isDark
                        ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(var(--gp-brandalt-500-rgb), 0.1)"
                        : "0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(var(--gp-brand-700-rgb), 0.05)"
                    : isDark
                      ? "0 2px 8px rgba(0,0,0,0.2)"
                      : "0 2px 8px rgba(0,0,0,0.04)",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                position: "relative",
                overflow: "hidden",
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Subtle glow effect on hover */}
            {isHovered && (
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "1px",
                        background: isDark
                            ? "linear-gradient(90deg, transparent 0%, rgba(var(--gp-brandalt-500-rgb), 0.5) 50%, transparent 100%)"
                            : "linear-gradient(90deg, transparent 0%, rgba(var(--gp-brand-700-rgb), 0.3) 50%, transparent 100%)",
                    }}
                />
            )}

            <Stack spacing={1.5}>
                {/* Header Row */}
                <Stack alignItems="center" direction="row" justifyContent="space-between">
                    {config && (
                        <Chip
                            size="sm"
                            startDecorator={config.icon}
                            variant="soft"
                            sx={{
                                borderRadius: "8px",
                                fontWeight: 600,
                                fontSize: "0.7rem",
                                px: 1,
                                py: 0.25,
                                background: isDark
                                    ? `linear-gradient(135deg, ${config.colorScheme.dark}15 0%, ${config.colorScheme.dark}08 100%)`
                                    : `linear-gradient(135deg, ${config.colorScheme.light}12 0%, ${config.colorScheme.light}06 100%)`,
                                color: isDark ? config.colorScheme.dark : config.colorScheme.light,
                                border: "1px solid",
                                borderColor: isDark
                                    ? `${config.colorScheme.dark}25`
                                    : `${config.colorScheme.light}20`,
                                "& .MuiChip-startDecorator": {
                                    color: "inherit",
                                },
                            }}
                        >
                            {t.inbox.requestTypes[config.labelKey]}
                        </Chip>
                    )}

                    <Typography
                        level="body-xs"
                        sx={{
                            color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                            fontSize: "0.7rem",
                            fontWeight: 500,
                        }}
                    >
                        {extractYYYYMMDDHHMM(inboxItem.tsSent)}
                    </Typography>
                </Stack>

                {/* Content — digest items carry {title, text} rather than
                    BlockNote blocks. The text is agent-authored MARKDOWN
                    (bold, bullets, workspace links resolved server-side),
                    rendered by the lazy DigestBody; while the chunk loads,
                    fall back to the old pre-wrapped plain text. */}
                {inboxItem.itemType === DIGEST && (
                    <DigestHeadline
                        isDark={isDark}
                        title={String(
                            (inboxItem.itemBody as unknown as { title?: string })?.title ?? ""
                        )}
                    />
                )}
                {inboxItem.itemType === DIGEST && (
                    <Suspense
                        fallback={
                            <Typography
                                level="body-sm"
                                sx={{
                                    whiteSpace: "pre-wrap",
                                    color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                                }}
                            >
                                {String(
                                    (inboxItem.itemBody as unknown as { text?: string })?.text ??
                                        ""
                                )}
                            </Typography>
                        }
                    >
                        <DigestBody
                            isDark={isDark}
                            text={String(
                                (inboxItem.itemBody as unknown as { text?: string })?.text ?? ""
                            )}
                        />
                    </Suspense>
                )}
                {legacyText !== "" && (
                    <Typography
                        level="body-sm"
                        sx={{
                            whiteSpace: "pre-wrap",
                            color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                        }}
                    >
                        {legacyText}
                    </Typography>
                )}
                {reminderOptionals && (
                    <Stack spacing={0.75}>
                        <Typography
                            level="body-sm"
                            sx={{ color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)" }}
                        >
                            {reminderSender
                                ? fmt(t.inbox.messageReminder.headlineFrom, {
                                      name: reminderSender,
                                  })
                                : t.inbox.messageReminder.headline}
                        </Typography>
                        {/* The message itself, quoted. A reminder whose
                            subject you have to go and look up is a reminder
                            you postpone, so the text comes with it.

                            Through `EmojiText` because this preview is the
                            message's stored `body_text`, where a custom
                            emoji is its `:name:` shortcode — printed raw it
                            reads as literal text in the one place the
                            reader is being asked to recognise their own
                            message. Same treatment as the chat list,
                            activity feed and flagged list. */}
                        {reminderPreview !== "" && (
                            <Typography
                                level="body-sm"
                                sx={{
                                    whiteSpace: "pre-wrap",
                                    pl: 1,
                                    borderLeft: "2px solid",
                                    borderColor: isDark
                                        ? "rgba(196,181,253,0.45)"
                                        : "rgba(124,58,237,0.35)",
                                    fontStyle: "italic",
                                    color: isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.68)",
                                }}
                            >
                                <EmojiText text={reminderPreview} />
                            </Typography>
                        )}
                    </Stack>
                )}
                {inboxItem.itemType !== DIGEST &&
                    Array.isArray(inboxItem.itemBody) &&
                    inboxItem.itemBody[0]?.content?.length > 0 && (
                        <Box
                            sx={{
                                "& .inbox-preview": {
                                    fontSize: "0.85rem",
                                    color: isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.75)",
                                },
                            }}
                        >
                            <MessageBody
                                key={`${inboxItem.itemType}-${inboxItem.itemId}-${inboxItem.tsSent}`}
                                content={inboxItem.itemBody}
                                customClassName="inbox-preview"
                                isSent={true}
                                myself={myself}
                                setMyself={setMyself}
                                socket={socket}
                                useCM={useCM}
                                useTEM={useTEM}
                                useUISM={useUISM}
                            />
                        </Box>
                    )}

                {/* What the card is ABOUT. The body names the target in plain
                    text, so you could read it but not open it — forcing you
                    out of the inbox to find what you were just approved for,
                    or who's asking for what. Renders nothing when the target
                    can't be resolved, which includes every activity row
                    created before activities carried ids. */}
                {canHaveTarget && (
                    // Line the chip up with the body text above it, or it
                    // reads as detached from the sentence it belongs to. The
                    // body is inset TWICE: MessageBody's own box padding,
                    // then `.inbox-preview-{light,dark} .bn-editor`. Clear
                    // both, via the variables rather than a hard-coded total.
                    <Box sx={{ pl: BODY_TEXT_INDENT }}>
                        <InboxTargetChip
                            inboxItem={inboxItem}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />
                    </Box>
                )}

                {/* Open-note affordance for a note-access request — opens
                    the referenced note in the URL-link modal on top of the
                    inbox (the owner has access, so it loads normally). */}
                {openableNote && urlLinkModal && (
                    // Indented to match the body, same as the target chip above.
                    <Box sx={{ pl: BODY_TEXT_INDENT }}>
                        <Chip
                            color="primary"
                            size="sm"
                            startDecorator={<StickyNote2RoundedIcon sx={{ fontSize: 14 }} />}
                            variant="soft"
                            sx={{
                                cursor: "pointer",
                                maxWidth: "100%",
                                borderRadius: "8px",
                                fontWeight: 600,
                                "& .MuiChip-label": {
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                },
                            }}
                            onClick={() => urlLinkModal.openModalByHref(openableNote.href)}
                        >
                            {fmt(t.inbox.noteAccess.openNoteNamed, { title: openableNote.title })}
                        </Chip>
                    </Box>
                )}

                {/* Jump to the message the reminder is about. Same URL-link
                    modal as the note affordance, so acting on a reminder
                    doesn't cost you the inbox you were working through —
                    with `fullPageHref` offering the preview's Move-to-page
                    button for when the reader wants the chat itself. The
                    href names the message, so either way it opens focused
                    on the bubble rather than at the chat. */}
                {reminderOptionals && reminderHref !== "" && urlLinkModal && (
                    <Box sx={{ pl: BODY_TEXT_INDENT }}>
                        <Chip
                            size="sm"
                            startDecorator={<ChatRoundedIcon sx={{ fontSize: 14 }} />}
                            variant="soft"
                            sx={{
                                cursor: "pointer",
                                maxWidth: "100%",
                                borderRadius: "8px",
                                fontWeight: 600,
                                background: isDark
                                    ? "rgba(196,181,253,0.16)"
                                    : "rgba(124,58,237,0.10)",
                                color: isDark ? "#c4b5fd" : "#7c3aed",
                                "& .MuiChip-startDecorator": { color: "inherit" },
                                "& .MuiChip-label": {
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                },
                            }}
                            onClick={() =>
                                urlLinkModal.openModalByHref(reminderHref, {
                                    fullPageHref: reminderHref,
                                })
                            }
                        >
                            {reminderChatName
                                ? fmt(t.inbox.messageReminder.openInNamed, {
                                      chat: reminderChatName,
                                  })
                                : t.inbox.messageReminder.openMessage}
                        </Chip>
                    </Box>
                )}

                {/* When an unanswered ownership claim becomes actionable
                    by the person who filed it. The body says how many
                    days; this says the date, because "30 days" read
                    three weeks late is not a warning. Only while the
                    claim is still open — after a decision the deadline
                    is spent. */}
                {claimDeadline && !isHandled && (
                    <Box sx={{ pl: BODY_TEXT_INDENT }}>
                        <Typography
                            level="body-xs"
                            startDecorator={<ScheduleRoundedIcon sx={{ fontSize: 14 }} />}
                            sx={{
                                color: isDark ? "#f87171" : "#ef4444",
                                fontWeight: 600,
                            }}
                        >
                            {fmt(t.inbox.ownershipClaim.respondBy, {
                                date: extractYYYYMMDD(claimDeadline),
                            })}
                        </Typography>
                    </Box>
                )}

                {/* WHO is asking, and WHAT for. The body says both in a
                    sentence; these two cards are the ones where the subject
                    is the whole decision — another organization, and one
                    named thing of yours — so it gets to be a chip too. */}
                {isCrossTeam && (
                    <Box sx={{ pl: BODY_TEXT_INDENT }}>
                        <InboxCrossTeamChips inboxItem={inboxItem} />
                    </Box>
                )}

                {/* Where the thing you just accepted has landed. */}
                {acceptedIn && (
                    <Box sx={{ pl: BODY_TEXT_INDENT }}>
                        <Typography level="body-xs" sx={{ color: labelSubtleColor }}>
                            {acceptedIn}
                        </Typography>
                    </Box>
                )}

                {/* What answering this actually does. The body says who is
                    asking; this says what the button means, which for both
                    cross-team types is narrower than it sounds. */}
                {crossTeamHint && !isHandled && (
                    <Box sx={{ pl: BODY_TEXT_INDENT }}>
                        <Typography level="body-xs" sx={{ color: labelSubtleColor }}>
                            {crossTeamHint}
                        </Typography>
                    </Box>
                )}

                {respondError && (
                    <Box sx={{ pl: BODY_TEXT_INDENT }}>
                        <Typography color="danger" level="body-xs">
                            {respondError}
                        </Typography>
                    </Box>
                )}

                {/* Action Buttons */}
                {isRequest && (
                    <Stack
                        direction="row"
                        justifyContent="flex-end"
                        spacing={1}
                        // Approve/Reject labels are longer in several locales;
                        // wrapping beats overflowing a 390px card.
                        sx={{ flexWrap: "wrap", rowGap: 1 }}
                    >
                        {isHandled ? (
                            <Button
                                color={resolvedStatus === "rejected" ? "neutral" : "success"}
                                size="sm"
                                variant="soft"
                                startDecorator={
                                    resolvedStatus === "rejected" ? (
                                        <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                    ) : (
                                        <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                    )
                                }
                                sx={{
                                    borderRadius: "10px",
                                    fontWeight: 600,
                                    fontSize: "0.75rem",
                                    px: 2,
                                    py: 0.75,
                                    background:
                                        resolvedStatus === "rejected"
                                            ? palette.dangerTintBg
                                            : palette.successTintBg,
                                    color:
                                        resolvedStatus === "rejected"
                                            ? palette.dangerTint
                                            : palette.successTint,
                                    "&.Mui-disabled": {
                                        opacity: 0.9,
                                    },
                                }}
                                disabled
                            >
                                {resolvedStatus === "rejected"
                                    ? t.inbox.bubble.rejected
                                    : t.inbox.bubble.approved}
                            </Button>
                        ) : (
                            <>
                                <Button
                                    color="danger"
                                    size="sm"
                                    startDecorator={<CloseRoundedIcon sx={{ fontSize: 16 }} />}
                                    variant="outlined"
                                    sx={{
                                        borderRadius: "10px",
                                        fontWeight: 600,
                                        fontSize: "0.75rem",
                                        px: 2,
                                        py: 0.75,
                                        borderColor: palette.dangerTintBorder,
                                        color: palette.dangerTint,
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            background: palette.dangerTintBg,
                                            borderColor: palette.dangerTintBorder,
                                            transform: "translateY(-1px)",
                                        },
                                        "&:active": {
                                            transform: "translateY(0)",
                                        },
                                    }}
                                    onClick={handleReject}
                                >
                                    {t.inbox.bubble.reject}
                                </Button>
                                <Button
                                    size="sm"
                                    startDecorator={<CheckRoundedIcon sx={{ fontSize: 16 }} />}
                                    variant="solid"
                                    sx={{
                                        borderRadius: "10px",
                                        fontWeight: 600,
                                        fontSize: "0.75rem",
                                        px: 2.5,
                                        py: 0.75,
                                        background: palette.primaryButtonBg,
                                        boxShadow: palette.primaryButtonShadow,
                                        transition: "all 0.2s ease",
                                        "&:hover": {
                                            background: palette.primaryButtonHover,
                                            transform: "translateY(-1px)",
                                            boxShadow: isDark
                                                ? "0 6px 16px rgba(var(--gp-brand-700-rgb), 0.5)"
                                                : "0 6px 16px rgba(var(--gp-brand-700-rgb), 0.4)",
                                        },
                                        "&:active": {
                                            transform: "translateY(0)",
                                        },
                                    }}
                                    onClick={handleApprove}
                                >
                                    {t.inbox.bubble.approve}
                                </Button>
                            </>
                        )}
                    </Stack>
                )}
            </Stack>
        </Card>
    );
};

// Export helper for generating approval notification body
export const getItemBody = (requestType: number, targetName: string) => {
    const messages = getMessages();
    const requestNameLookUp: Record<number, string> = {
        1: messages.inbox.requestTargets.team,
        2: messages.inbox.requestTargets.project,
    };

    return [
        {
            type: "paragraph",
            props: {
                textColor: "default",
                textAlignment: "left",
                backgroundColor: "default",
            },
            content: [
                {
                    text: fmt(messages.inbox.notification.approvalBody, {
                        target: requestNameLookUp[requestType],
                    }),
                    type: "text",
                    styles: {},
                },
                {
                    text: targetName,
                    type: "text",
                    styles: { bold: true, textColor: "pink" },
                },
            ],
            children: [],
        },
        {
            type: "paragraph",
            props: {
                textColor: "default",
                textAlignment: "left",
                backgroundColor: "default",
            },
            content: [],
            children: [],
        },
    ];
};
