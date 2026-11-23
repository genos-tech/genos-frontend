import { lazy, Suspense } from "react";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import { Box, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { MessageBody } from "../../../components/messageBody/MessageBody";
import { ResolvedUserName } from "../../../components/ui/avatars/AvatarContext";
import { Bubble } from "../../../components/ui/bubble";
import { EmojiText } from "../../../components/ui/emoji/EmojiText";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../../hooks/common/UrlLinkModalContext";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { fmt, useTranslation } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import { UserProps } from "../../../types/admin";
import { InboxItemProps } from "../../../types/common";
import { extractYYYYMMDD } from "../../../utils/dateUtils";
import { useMarkReadOnView } from "../hooks/useMarkReadOnView";
import { isActivityItemType } from "../utils/inboxItemTypes";
import { resolveInboxTarget } from "../utils/resolveInboxTarget";
import { AiUsageFooter } from "./AiUsageFooter";
import { DigestHeadline } from "./DigestHeadline";
import { GenosReportBody } from "./GenosReportBody";
import { fallbackTargetName, joinTitleKey, resolveActor, splitAroundName } from "./inboxActor";
import { InboxCrossTeamChips } from "./InboxCrossTeamChips";
import { InboxItemAvatar } from "./InboxItemAvatar";
import {
    DIGEST,
    EXTERNAL_SHARE,
    GENOS_REPORT,
    isGenosAuthored,
    MESSAGE_REMINDER,
    NOTE_ACCESS_REQUEST,
    OWNERSHIP_CLAIM,
    pickConfig,
    TEAM_CONNECTION,
} from "./inboxItemConfig";
import { InboxItemContext } from "./InboxItemContext";
import { InboxItemMeta } from "./InboxItemMeta";
import { InboxLinkChip, InboxTargetText } from "./InboxLinkChip";
import { reminderParts } from "./inboxReminder";
import { InboxRequestActions } from "./InboxRequestActions";
import { InboxTargetChip } from "./InboxTargetChip";
import { useInboxResponse } from "./useInboxResponse";

// Lazy: keeps react-markdown (and its remark deps) out of the inbox's
// initial chunk — only digest bubbles ever need it.
const DigestBody = lazy(() => import("./DigestBody"));

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
    /** The row the open route points at. */
    selected?: boolean;
};

/**
 * One Inbox card, for BOTH tabs: a calm row on the shared `Bubble` frame.
 *
 *     [face]  Title: who, and what they want (or the stored body)            ● 10:42  ✓
 *             type · what it points at
 *             [Approve] [Reject]
 *
 * The face is the person's real avatar (found in the body), the Genos mark, or the type's tile;
 * the type is folded into the context line instead of a chip of its own; the answer buttons sit
 * under the text they answer. Every action and every piece of data is what it was.
 */
export const InboxBubble = (props: InboxBubbleProps) => {
    const {
        useTEM,
        socket,
        myself,
        setMyself,
        inboxItem,
        useUISM,
        useCM,
        onItemChanged,
        selected,
    } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const { itemType, itemBody, itemOptionals } = inboxItem;

    // An activity (notice, digest, reminder, report) counts as read once it has been on screen
    // for a moment (MIP-1292, MIP-1627); a request gets no ref. `onItemChanged` re-reads the list
    // so the dot and the counts follow.
    const watchRef = useMarkReadOnView({
        itemId: inboxItem.itemId,
        itemType,
        isRead: inboxItem.isRead,
        userId: myself.userId,
        teamId: myself.teamId,
        onRead: onItemChanged,
    });
    // The unread dot and the read toggle belong to the Activities half: a request is read by
    // answering it.
    const isActivityCard = isActivityItemType(itemType);
    // Anything that isn't an activity is something somebody is waiting on an answer to. Asked as
    // "not an activity" rather than as a numeric range: an upper bound is how the two cross-team
    // types once shipped as cards with no Approve button.
    const isRequest = !isActivityCard;
    const config = pickConfig(inboxItem);
    const response = useInboxResponse(inboxItem, config, socket, onItemChanged);
    const { isHandled } = response;

    // Cards that can name an openable target: team/project/GM join requests (1-3) and activities
    // (0). Note-access (4) has its own open-note link. The link renders nothing when nothing
    // resolves, so this gate only decides where it's worth looking.
    const canHaveTarget = itemType >= 0 && itemType <= 3;
    const claimDeadline =
        itemType === OWNERSHIP_CLAIM ? (itemOptionals?.deadline as string | undefined) : undefined;
    const isCrossTeam = itemType === TEAM_CONNECTION || itemType === EXTERNAL_SHARE;
    // Only a share carries a footnote. A connection request already says, in its own body, that
    // connecting gives access to nothing; saying it again under the body read as a duplicate.
    const crossTeamHint = itemType === EXTERNAL_SHARE ? t.inbox.crossTeam.shareHint : null;
    // Where the accepted thing actually IS: accepting a share admits the approver and the object
    // joins their own lists, but nothing said so. This is the one sentence that closes that loop.
    const acceptedObjectType = String(itemOptionals?.object_type ?? "");
    const acceptedIn =
        itemType === EXTERNAL_SHARE && response.status === "approved"
            ? (t.inbox.crossTeam.acceptedIn[
                  acceptedObjectType as keyof typeof t.inbox.crossTeam.acceptedIn
              ] ?? null)
            : null;

    // The cross-team types were first written with a digest-style `{title, text}` body, which the
    // BlockNote renderer reads as an empty document. Read either shape rather than migrate them.
    const legacyBody =
        itemType !== DIGEST &&
        itemType !== MESSAGE_REMINDER &&
        itemType !== GENOS_REPORT &&
        !Array.isArray(itemBody)
            ? (itemBody as unknown as { title?: string; text?: string } | null)
            : null;
    const legacyText = legacyBody
        ? [legacyBody.title, legacyBody.text].filter(Boolean).join("\n")
        : "";

    const reminder = reminderParts(inboxItem, t);

    // Note-access requests (itemType 4) can open the referenced note in the URL-link modal. Only
    // personal notes (note_type 1) are routable from the stored optionals: the my-notes URL needs
    // just the id, whereas task/chat notes need ids the request doesn't carry.
    const urlLinkModal = useUrlLinkModal();
    const noteOptionals = itemType === NOTE_ACCESS_REQUEST ? itemOptionals : null;
    const openableNote =
        noteOptionals && noteOptionals.note_type === 1 && noteOptionals.note_id
            ? {
                  href: `/workspace/notes/my/${noteOptionals.note_id}`,
                  title: noteOptionals.note_title || t.inbox.noteAccess.openNote,
              }
            : null;

    // WHO the card is about: the sender the inbox GET names, else the body's first mention (a row
    // stored before the API sent senders, or delivered live). A card Genos wrote has no person.
    const byGenos = isGenosAuthored(inboxItem);
    const actor = byGenos ? null : resolveActor(inboxItem);
    // The join requests say one short sentence in the reader's language, with the name in bold,
    // instead of the server's English body and its "Waiting for your approval..." filler. Without
    // a name to put in it, the card keeps the stored body.
    const joinKey = joinTitleKey(itemType, actor);
    const joinParts = joinKey ? splitAroundName(t.inbox.card[joinKey]) : null;
    // The sentence no longer carries the project, chat or note, so the context line must. When the
    // link cannot open it (a chat not in the reader's list yet, a task note), the name still shows
    // as text: it is the thing being asked about.
    const targetOpens =
        (canHaveTarget &&
            resolveInboxTarget(
                inboxItem,
                useCM.allChats,
                useTEM.currentTeam?.teamName || myself.teamName || ""
            ) !== null) ||
        (openableNote !== null && Boolean(urlLinkModal));
    const plainTarget = joinKey && !targetOpens ? fallbackTargetName(inboxItem) : "";

    const hasBlockBody =
        itemType !== DIGEST &&
        itemType !== GENOS_REPORT &&
        Array.isArray(itemBody) &&
        itemBody[0]?.content?.length > 0;

    const unread = isActivityCard ? !inboxItem.isRead : !isHandled;
    const meta = (
        <InboxItemMeta
            inboxItem={inboxItem}
            isActivity={isActivityCard}
            teamId={myself.teamId}
            unread={unread}
            userId={myself.userId}
            onChanged={onItemChanged}
        />
    );

    // The one title line, which is the body for a card that has no composed sentence.
    let title: React.ReactNode = null;
    if (joinParts && actor) {
        title = (
            <Typography component="p" sx={{ ...type("body-md"), color: g.text.primary, m: 0 }}>
                {joinParts[0]}
                <Box component="strong" sx={{ fontWeight: 600 }}>
                    {/* The person's name today, not the one the request was filed under. */}
                    <ResolvedUserName fallbackName={actor.userName} userId={actor.userId} />
                </Box>
                {joinParts[1]}
            </Typography>
        );
    } else if (reminder) {
        title = (
            <Typography component="p" sx={{ ...type("body-md"), color: g.text.primary, m: 0 }}>
                {reminder.headline}
            </Typography>
        );
    } else if (hasBlockBody) {
        title = (
            <Box
                sx={{
                    // BnChatPreview puts `inbox-preview-light|dark` on its box (never a bare
                    // `inbox-preview`), so selectors here match the `inbox-preview-` prefix.
                    // The font size lives on `.bn-editor` below.
                    "&& .bn-editor": {
                        paddingInline: 0,
                        background: "transparent",
                        fontSize: "0.875rem",
                        lineHeight: 1.45,
                    },
                    // The editor's own side padding and white fill belong to a full-width editor;
                    // here the avatar column carries the indent and the row its own surface.
                    "&& .bn-container": {
                        background: "transparent",
                        "--bn-colors-editor-background": "transparent",
                    },
                    // Each paragraph takes its own direction from its first strong letter:
                    // server-written English in an Arabic UI kept its period at the line
                    // start (MIP-1180).
                    '& [class*="inbox-preview-"] p, & [class*="inbox-preview-"] li': {
                        unicodeBidi: "plaintext",
                    },
                }}
            >
                <MessageBody
                    key={`${itemType}-${inboxItem.itemId}-${inboxItem.tsSent}`}
                    content={itemBody}
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
        );
    } else if (legacyText !== "") {
        title = (
            <Typography sx={{ ...type("body-md"), color: g.text.primary, whiteSpace: "pre-wrap" }}>
                {legacyText}
            </Typography>
        );
    }
    const hasTitle = title !== null;

    return (
        <Bubble
            align="gutter"
            bodyOffset={0.25}
            layout="compact"
            narrowBody="beside"
            rootRef={watchRef}
            selected={selected}
            avatar={
                <InboxItemAvatar
                    actor={actor}
                    byGenos={byGenos}
                    Icon={config?.Icon ?? NotificationsNoneRoundedIcon}
                    tone={config?.tone ?? "neutral"}
                />
            }
            header={
                hasTitle ? (
                    <Stack alignItems="flex-start" direction="row" spacing={1.5}>
                        <Box sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{title}</Box>
                        {meta}
                    </Stack>
                ) : undefined
            }
            sx={{
                py: 1.5,
                px: { xs: 1.5, md: 2 },
                // The avatar column now carries the indent, so the body text starts flush with
                // the title: no second inset inside the BlockNote preview.
                "--bn-preview-box-px": "0px",
                "--inbox-preview-indent": "0px",
            }}
        >
            <InboxItemContext
                Icon={reminder ? undefined : config?.Icon}
                label={config && !reminder ? t.inbox.requestTypes[config.labelKey] : undefined}
                meta={hasTitle ? undefined : meta}
            >
                {/* What the card is ABOUT. The body names the target in plain text, so you could
                    read it but not open it. Renders nothing when the target can't be resolved,
                    which includes every activity row created before activities carried ids. */}
                {canHaveTarget && (
                    <InboxTargetChip
                        inboxItem={inboxItem}
                        myself={myself}
                        setMyself={setMyself}
                        showIcon={!config}
                        socket={socket}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                )}
                {plainTarget !== "" && <InboxTargetText label={plainTarget} />}
                {openableNote && urlLinkModal && (
                    <InboxLinkChip
                        Icon={StickyNote2RoundedIcon}
                        label={fmt(t.inbox.noteAccess.openNoteNamed, {
                            title: openableNote.title,
                        })}
                        onClick={() => urlLinkModal.openModalByHref(openableNote.href)}
                    />
                )}
                {/* Jump to what the reminder is about, in the same URL-link modal, so acting on a
                    reminder doesn't cost you the inbox you were working through. */}
                {reminder && reminder.href !== "" && urlLinkModal && (
                    <InboxLinkChip
                        Icon={reminder.OpenIcon}
                        label={reminder.openLabel}
                        onClick={() =>
                            urlLinkModal.openModalByHref(reminder.href, {
                                fullPageHref: reminder.href,
                            })
                        }
                    />
                )}
            </InboxItemContext>

            {/* The subject itself, quoted: the message, or the to-do's title. A reminder whose
                subject you have to go and look up is a reminder you postpone. Through `EmojiText`
                because this preview is the stored `body_text`, where a custom emoji is its
                `:name:` shortcode. */}
            {reminder && reminder.preview !== "" && (
                <Typography
                    sx={{
                        ...type("body-sm"),
                        mt: 0.75,
                        pl: 1,
                        whiteSpace: "pre-wrap",
                        borderLeft: "2px solid",
                        borderColor: g.accent.border,
                        color: g.text.secondary,
                    }}
                >
                    <EmojiText text={reminder.preview} />
                </Typography>
            )}

            {/* Digest items carry {title, text} rather than BlockNote blocks. The text is
                agent-authored MARKDOWN, rendered by the lazy DigestBody; while the chunk loads,
                fall back to plain text. */}
            {itemType === DIGEST && (
                <Box sx={{ mt: 0.75 }}>
                    <DigestHeadline
                        isDark={isDark}
                        title={String((itemBody as unknown as { title?: string })?.title ?? "")}
                    />
                    <Suspense
                        fallback={
                            <Typography
                                level="body-sm"
                                sx={{ whiteSpace: "pre-wrap", color: g.text.primary }}
                            >
                                {String((itemBody as unknown as { text?: string })?.text ?? "")}
                            </Typography>
                        }
                    >
                        <DigestBody
                            isDark={isDark}
                            text={String((itemBody as unknown as { text?: string })?.text ?? "")}
                        />
                    </Suspense>
                </Box>
            )}
            {itemType === GENOS_REPORT && (
                <Box sx={{ mt: 0.75 }}>
                    <GenosReportBody
                        allChats={useCM.allChats}
                        itemBody={itemBody}
                        teamId={myself.teamId}
                        userId={myself.userId}
                    />
                </Box>
            )}
            {/* What an AI-made digest or report cost, and its off switch (MIP-1227). Draws nothing
                for any other item, however its optionals look. */}
            <AiUsageFooter
                aiSource={inboxItem.aiSource}
                itemId={inboxItem.itemId}
                itemOptionals={itemOptionals}
                itemType={itemType}
                userId={myself.userId}
            />

            {/* When an unanswered ownership claim becomes actionable by the person who filed it.
                The body says how many days; this says the date, because "30 days" read three
                weeks late is not a warning. Only while the claim is still open. */}
            {claimDeadline && !isHandled && (
                <Typography
                    level="body-xs"
                    startDecorator={<ScheduleRoundedIcon sx={{ fontSize: 14 }} />}
                    sx={{ mt: 0.75, color: g.danger.text, fontWeight: 500 }}
                >
                    {fmt(t.inbox.ownershipClaim.respondBy, {
                        date: extractYYYYMMDD(claimDeadline),
                    })}
                </Typography>
            )}

            {/* WHO is asking, and WHAT for: for these two cards the subject is the whole decision
                (another organization, one named thing of yours). */}
            {isCrossTeam && (
                <Box sx={{ mt: 0.75 }}>
                    <InboxCrossTeamChips inboxItem={inboxItem} />
                </Box>
            )}

            {/* Where the thing you just accepted has landed, or what answering this actually does
                (narrower than it sounds, for both cross-team types). */}
            {(acceptedIn || (crossTeamHint && !isHandled)) && (
                <Typography level="body-xs" sx={{ mt: 0.5, color: g.text.tertiary }}>
                    {acceptedIn ?? crossTeamHint}
                </Typography>
            )}

            {isRequest && (
                <InboxRequestActions
                    error={response.error}
                    status={response.status}
                    onApprove={response.approve}
                    onReject={response.reject}
                />
            )}
        </Bubble>
    );
};
