import { memo, useEffect, useMemo, useRef, useState } from "react";
import CodeIcon from "@mui/icons-material/Code";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import WrapTextIcon from "@mui/icons-material/WrapText";
import { Box, IconButton, Stack } from "@mui/joy";
import { Socket } from "socket.io-client";

import { MessageBody } from "../../../../../../components/messageBody/MessageBody";
import { AppTooltip } from "../../../../../../components/ui/AppTooltip";
import { ResolvedUserName } from "../../../../../../components/ui/avatars/AvatarContext";
import { UserAvatar } from "../../../../../../components/ui/avatars/UserAvatar";
import { Bubble, BubbleAuthor, BubbleMeta } from "../../../../../../components/ui/bubble";
import { EmojiPicker } from "../../../../../../components/ui/emoji/EmojiPicker";
import { ReactionTaskCommentEmojiDisplay } from "../../../../../../components/ui/emoji/ReactionTaskCommentEmojiDisplay";
import { TaskCommentEmojiReaction } from "../../../../../../components/ui/emoji/TaskCommentEmojiReaction";
import { MoreMenu, MoreMenuItem } from "../../../../../../components/ui/MoreMenu";
import { ChatManagementState } from "../../../../../../hooks/chats/useChatManagement";
import { useBubbleStylePreference } from "../../../../../../hooks/common/useBubbleStylePreference";
import { useDoubleClickTodoPreference } from "../../../../../../hooks/common/useDoubleClickTodoPreference";
import { TeamManagementState } from "../../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../../../../../i18n";
import { g } from "../../../../../../theme/tokens";
import { UserProps } from "../../../../../../types/admin";
import { MessageProps, ThreadMessageProps } from "../../../../../../types/chat";
import { ReactionProps } from "../../../../../../types/common";
import { TaskCommentProps } from "../../../../../../types/tasks";
import {
    extractMMDDHHMMSSs,
    extractYYYYMMDDHHMM,
    getLocalCurrentTimestamp,
} from "../../../../../../utils/dateUtils";
import { ModalDeleteTaskComment } from "../../../modals/ModalDeleteTaskComment";

type TaskCommentBubbleProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    comment: TaskCommentProps;
    currentProjectId?: number;
    currentProjectName?: string;
    /** Parent task's human-readable id ("<code>-<n>"), threaded down
     *  to the reaction emits so their derived activity broadcasts can
     *  stamp it onto the chat-activity-sidebar entry. Without this the
     *  activity item for a reaction falls back to "#<taskId>". */
    currentTaskDisplayId?: string | null;
    setIsInEdit: (value: boolean) => void;
    setEditTargetComment: (value: TaskCommentProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    /** When true, render the bubble with the green focus palette so the
     * deep-link target stands out after navigation. Owned by
     * `TaskCommentList`, which derives it from the URL's `commentId`. */
    isFocused?: boolean;
    /** Click handler that updates the URL with this comment's deep
     * link, receiving the clicked comment's id. Optional so callers
     * that don't wire routing (none today, but keeps the bubble
     * reusable) get the original non-clickable behaviour. Taking the id
     * lets the list pass ONE stable callback to every row instead of a
     * fresh per-row closure — which is what lets `memo` skip untouched
     * bubbles during scroll. */
    onCommentClick?: (commentId: number) => void;
    /** App-relative deep-link path for this comment (same URL
     * `onCommentClick` navigates to), threaded from `TaskCommentList`.
     * Drives the more-menu's "Copy comment link" item; when absent the
     * item is hidden (mount without routing wired). */
    commentLink?: string;
    setTodoFromMessageBubble?: (
        todoFromMessageBubble: MessageProps | ThreadMessageProps | TaskCommentProps
    ) => void;
    /** Stacking level of the hosting surface, threaded down from
     * `TaskTabBlock` when the preview is UrlLinkModal-hosted. The
     * delete-confirm dialog derives its z from this so it opens ABOVE
     * the preview modal instead of invisibly behind it (the known
     * 10010-family bug). Absent on page-hosted mounts. */
    hostZIndex?: number;
};

const TaskCommentBubbleImpl = (props: TaskCommentBubbleProps) => {
    const {
        socket,
        myself,
        setMyself,
        comment,
        currentProjectId,
        currentProjectName,
        currentTaskDisplayId,
        setIsInEdit,
        setEditTargetComment,
        useCM,
        useTEM,
        useUISM,
        isFocused = false,
        onCommentClick,
        commentLink,
        setTodoFromMessageBubble,
        hostZIndex,
    } = props;

    const { t } = useTranslation();
    const { style } = useBubbleStylePreference();
    const isCompact = style === "compact";
    const { enabled: doubleClickTodoEnabled } = useDoubleClickTodoPreference();
    const isSent = comment.senderId === myself.userId;
    // The commenter's name is live-resolved by the `<ResolvedUserName>`
    // leaf in the name slot (so a rename shows on existing comments) —
    // isolating that AvatarContext subscription to the leaf lets this
    // memoized bubble skip the periodic `teamMemberProfiles` churn.

    // Two date-parses; memoize so they don't run on every re-render.
    const isEdited = useMemo(
        () => extractMMDDHHMMSSs(comment.tsSent) !== extractMMDDHHMMSSs(comment.tsUpdated),
        [comment.tsSent, comment.tsUpdated]
    );
    // Rendered date label, also memoized (parses `tsSent`).
    const sentLabel = useMemo(() => extractYYYYMMDDHHMM(comment.tsSent), [comment.tsSent]);

    // Reaction handling
    const [showUnderBarOption, setShowUnderBarOption] = useState(false);
    const [reactions, setReactions] = useState<ReactionProps[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    // Delete-confirm dialog (own comments only; the button below is
    // gated on `isSent`).
    const [openDeleteComment, setOpenDeleteComment] = useState<boolean>(false);
    // Per-bubble wrap toggles. Same CSS-class approach as the chat
    // message bubbles — class lives on a wrapper Box around the
    // preview, App.css drives the actual wrap/scroll behaviour.
    const [unwrapAll, setUnwrapAll] = useState<boolean>(false);
    const [unwrapCode, setUnwrapCode] = useState<boolean>(false);
    // Keeps the hover toolbar mounted while the ⋮ menu's portal is open
    // — the pointer leaves the bubble when it moves onto the dropdown,
    // and unmounting the toolbar would tear the open menu down with it
    // (same pattern as MessageBubble's isMoreMenuOpen).
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
    // Keeps the quick-emoji row visible under the same condition as the
    // toolbar that hosts it, mirroring MessageBubble's combined
    // `showUnderBarOption` (which already ORs in its own more-menu flag).
    const showToolbarActions = showUnderBarOption || isMoreMenuOpen;
    const previewWrapClassName = useMemo(
        () =>
            [unwrapAll && "bn-unwrap-all", unwrapCode && "bn-unwrap-code"]
                .filter(Boolean)
                .join(" "),
        [unwrapAll, unwrapCode]
    );

    // Bind this comment's id onto the stable list-level handler. Kept
    // undefined when no handler is wired so the non-clickable visual
    // behaviour (default cursor, no onClick) is preserved.
    const handleCommentClick = useMemo(
        () => (onCommentClick ? () => onCommentClick(comment.commentId) : undefined),
        [onCommentClick, comment.commentId]
    );

    useEffect(() => {
        if (comment.reactions) {
            setReactions(comment.reactions);
        }
    }, []);

    useEffect(() => {
        if (comment.reactions) {
            setReactions(comment.reactions);
        }
    }, [comment]);

    useEffect(() => {
        if (selectedEmoji !== null) {
            const existingIndex = reactions.findIndex(
                (r) => r.emoji === selectedEmoji && r.sender.userId === myself.userId
            );
            if (existingIndex !== -1) {
                const updatedReactions = reactions.filter((_, idx) => idx !== existingIndex);
                setReactions(updatedReactions);
                if (socket) {
                    socket.emit("task_comment_reaction", {
                        method_type: "DELETE",
                        team_id: myself.teamId,
                        project_id: currentProjectId,
                        project_name: currentProjectName,
                        task_id: comment.taskId,
                        display_id: currentTaskDisplayId,
                        comment_id: comment.commentId,
                        comment_body: comment.commentBody,
                        comment_sender_id: comment.senderId,
                        comment_sender_name: comment.senderName,
                        reaction_emoji: selectedEmoji,
                    });
                }
            } else {
                setReactions([
                    ...reactions,
                    {
                        id: -1,
                        emoji: selectedEmoji,
                        sender: myself,
                        tsSent: getLocalCurrentTimestamp(),
                    },
                ]);
                if (socket) {
                    socket.emit("task_comment_reaction", {
                        method_type: "POST",
                        team_id: myself.teamId,
                        project_id: currentProjectId,
                        project_name: currentProjectName,
                        task_id: comment.taskId,
                        display_id: currentTaskDisplayId,
                        comment_id: comment.commentId,
                        comment_body: comment.commentBody,
                        comment_sender_id: comment.senderId,
                        comment_sender_name: comment.senderName,
                        reaction_emoji: selectedEmoji,
                    });
                }
            }
            setSelectedEmoji(null);
        }
    }, [selectedEmoji]);

    const boxRef = useRef<HTMLDivElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [pickerTopPosition, setPickerTopPosition] = useState<number | string>("auto");
    const [pickerBottomPosition, setPickerBottomPosition] = useState<number | string>("auto");
    const [pickerRightPosition, setPickerRightPosition] = useState<number | string>("auto");
    const [pickerLeftPosition, setPickerLeftPosition] = useState<number | string>("auto");
    const [emojiPickerPositionCalculated, setEmojiPickerPositionCalculated] =
        useState<boolean>(false);

    useEffect(() => {
        if (showEmojiPicker) {
            const anchor = isCompact && toolbarRef.current ? toolbarRef.current : boxRef.current;
            if (!anchor) return;
            const rect = anchor.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const pickerHeight = 435;
            const pickerWidth = 352;

            if (viewportHeight - rect.bottom > pickerHeight + 20) {
                setPickerTopPosition(rect.bottom + 10);
                setPickerBottomPosition("auto");
            } else if (rect.top > pickerHeight + 20) {
                setPickerTopPosition(rect.top - pickerHeight - 10);
                setPickerBottomPosition("auto");
            } else {
                setPickerTopPosition(20);
                setPickerBottomPosition("auto");
            }

            const desiredLeft = rect.right - pickerWidth;
            const leftPos = Math.max(20, Math.min(desiredLeft, viewportWidth - pickerWidth - 20));
            setPickerLeftPosition(leftPos);
            setPickerRightPosition("auto");
            setEmojiPickerPositionCalculated(true);
        }

        if (showEmojiPicker === false) {
            setEmojiPickerPositionCalculated(false);
        }
    }, [showEmojiPicker, isCompact]);

    // Empty-comment guard. The old check read
    // `commentBody[0].content.length`, which (a) crashed on comments
    // whose FIRST block is an image/file (those carry no `content`
    // array — possible since drag-and-drop into the comment editor) and
    // (b) would have hidden such comments even without the crash. A
    // comment is empty only when NO block carries anything: media
    // blocks ARE content, table blocks carry object content, nested
    // children are walked.
    const blockHasContent = (block: any): boolean => {
        if (!block) return false;
        if (["image", "file", "video", "audio"].includes(block.type)) return true;
        if (Array.isArray(block.content) ? block.content.length > 0 : block.content != null) {
            return true;
        }
        return Array.isArray(block.children) && block.children.some(blockHasContent);
    };
    if (!comment.commentBody?.some?.(blockHasContent)) {
        return null;
    }

    // Quick-add emoji row (3 default picks + open-picker icon), placed
    // in the hover toolbar next to Edit/⋮ — mirroring MessageBubble's
    // `EmojiReaction` sitting alongside `BubbleMoreMenu`. The counted
    // reaction chips stay separate, in `reactionsDisplay` below.
    const quickEmojiReaction = (
        <TaskCommentEmojiReaction
            comment={comment}
            myself={myself}
            projectId={currentProjectId}
            projectName={currentProjectName}
            reactions={reactions}
            setReactions={setReactions}
            setShowEmojiPicker={setShowEmojiPicker}
            showUnderBarOption={showToolbarActions}
            socket={socket}
            taskDisplayId={currentTaskDisplayId}
        />
    );

    const editButton = (
        <AppTooltip title={t.tasks.comment.editTooltip}>
            <IconButton
                size="sm"
                sx={{
                    width: 28,
                    height: 28,
                    borderRadius: g.radius.md,
                    transition: "all 0.15s ease",
                    color: g.text.secondary,
                    background: "transparent",
                    "&:hover": {
                        background: g.warning.subtle,
                        color: g.warning.text,
                    },
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsInEdit(true);
                    setEditTargetComment(comment);
                }}
            >
                <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
        </AppTooltip>
    );

    const handleCopyLinkClick = async () => {
        if (!commentLink) return;
        try {
            await navigator.clipboard.writeText(`${window.location.origin}${commentLink}`);
        } catch (err) {
            console.error("Failed to copy link:", err);
        }
    };

    // Everything except edit lives in the ⋮ menu to keep the hover
    // toolbar down to two buttons. Delete stays own-comments-only; the
    // menu item just opens the confirm dialog — the dialog owns the
    // socket DELETE emit (mirroring how `ModalDeleteMessage` owns the
    // chat-message delete), so no callback is threaded down from
    // `TaskPreview`. The delete is a soft-delete server-side, and the
    // `wsType: "task"` broadcast it triggers is what refreshes every
    // mounted list (host preview, chat-thread Comments tab, modal) via
    // the scoped `task-touched` bus.
    // Keys sorted alphabetically (case-insensitive) per `sort-keys`.
    const moreMenuItems: MoreMenuItem[] = [
        {
            icon: <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
            id: "copyLink",
            kind: "copyLink",
            label: t.tasks.comment.copyLink,
            onClick: handleCopyLinkClick,
            visible: !!commentLink,
        },
        {
            active: unwrapAll,
            icon: <WrapTextIcon sx={{ fontSize: 18 }} />,
            id: "unwrapAll",
            kind: "unwrapAll",
            label: unwrapAll ? t.tasks.comment.wrapAll : t.tasks.comment.unwrapAll,
            onClick: () => setUnwrapAll(!unwrapAll),
        },
        {
            active: unwrapCode,
            icon: <CodeIcon sx={{ fontSize: 18 }} />,
            id: "unwrapCode",
            kind: "unwrapCode",
            label: unwrapCode ? t.tasks.comment.wrapCode : t.tasks.comment.unwrapCode,
            onClick: () => setUnwrapCode(!unwrapCode),
        },
        {
            danger: true,
            icon: <DeleteOutlineIcon sx={{ fontSize: 18 }} />,
            id: "delete",
            kind: "delete",
            label: t.tasks.comment.deleteTooltip,
            onClick: () => setOpenDeleteComment(true),
            visible: isSent,
        },
    ];

    // The dropdown portals to document.body at zIndex 9999 — fine on
    // page mounts, but a UrlLinkModal-hosted preview (10020) would
    // cover it, so derive from the host's level when threaded down.
    const moreMenu = (
        <MoreMenu
            items={moreMenuItems}
            placement="bottom-end"
            zIndex={hostZIndex !== undefined ? hostZIndex + 1 : undefined}
            onOpenChange={setIsMoreMenuOpen}
        />
    );

    // Rendered in both layout branches (like the EmojiPicker) so the
    // dialog survives the hover toolbar unmounting when the pointer
    // moves off the bubble and onto the dialog.
    const deleteCommentModal = isSent ? (
        <ModalDeleteTaskComment
            comment={comment}
            currentProjectId={currentProjectId}
            currentProjectName={currentProjectName}
            currentTaskDisplayId={currentTaskDisplayId}
            hostZIndex={hostZIndex}
            open={openDeleteComment}
            setOpen={setOpenDeleteComment}
            socket={socket}
        />
    ) : null;

    const reactionsDisplay = (
        <Box onClick={(e) => e.stopPropagation()}>
            <ReactionTaskCommentEmojiDisplay
                comment={comment}
                myself={myself}
                projectId={currentProjectId}
                projectName={currentProjectName}
                reactions={reactions}
                setReactions={setReactions}
                socket={socket}
                taskDisplayId={currentTaskDisplayId}
            />
        </Box>
    );

    const commentBody = (
        <Box className={previewWrapClassName || undefined}>
            <MessageBody
                key={`${comment.taskId}-${comment.commentId}-${comment.tsSent}`}
                content={comment.commentBody}
                customClassName="task-comment-preview"
                isSent={isSent}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
            />
        </Box>
    );

    const header = (
        <Stack alignItems="center" direction="row" spacing={1}>
            <BubbleAuthor>
                <ResolvedUserName fallbackName={comment.senderName} userId={comment.senderId} />
            </BubbleAuthor>
            <BubbleMeta>
                {isEdited ? `${sentLabel} ${t.chat.bubble.edited}` : sentLabel}
            </BubbleMeta>
        </Stack>
    );

    const senderAvatar = (
        <UserAvatar
            fallbackName={comment.senderName}
            showPulseDot={false}
            userId={comment.senderId}
        />
    );

    // One frame for both looks of the bubble-style preference. The toolbar
    // (quick emoji, edit, more menu) stays mounted while the ⋮ menu is open.
    // The keyed remount on `tsUpdated` is the bubble look's (as before).
    return (
        <Bubble
            key={isCompact ? undefined : `${comment.commentId}-${comment.tsUpdated}`}
            actionsOpen={showToolbarActions}
            avatar={senderAvatar}
            bodyOffset={isCompact ? 0.25 : 0.5}
            emphasis={isFocused ? "focused" : false}
            footer={reactionsDisplay}
            header={header}
            interactive={!!onCommentClick}
            layout={isCompact ? "compact" : "bubble"}
            rootRef={boxRef}
            side={isSent ? "sent" : "received"}
            toolbarRef={toolbarRef}
            wrapperSx={{ py: 0.5 }}
            actions={
                <Stack alignItems="center" direction="row" spacing={0.25}>
                    {quickEmojiReaction}
                    {editButton}
                    {moreMenu}
                </Stack>
            }
            overlay={
                <>
                    {emojiPickerPositionCalculated === true && (
                        <EmojiPicker
                            pickerBottomPosition={pickerBottomPosition}
                            pickerLeftPosition={pickerLeftPosition}
                            pickerRightPosition={pickerRightPosition}
                            pickerTopPosition={pickerTopPosition}
                            setSelectedEmoji={setSelectedEmoji}
                            setShowEmojiPicker={setShowEmojiPicker}
                            showEmojiPicker={showEmojiPicker}
                            useFixedPosition={true}
                        />
                    )}
                    {deleteCommentModal}
                </>
            }
            onClick={handleCommentClick}
            onMouseEnter={() => setShowUnderBarOption(true)}
            onMouseLeave={() => setShowUnderBarOption(false)}
            onDoubleClick={
                doubleClickTodoEnabled
                    ? () => {
                          if (setTodoFromMessageBubble) {
                              setTodoFromMessageBubble({
                                  ...comment,
                                  projectId: currentProjectId ?? null,
                              });
                          }
                      }
                    : undefined
            }
        >
            {commentBody}
        </Bubble>
    );
};

// Custom comparator mirroring `MessageBubble` — comments arrive as fresh
// objects only when their content/flags actually change (the list keys
// each row on `commentId + tsUpdated`), so a reference compare on
// `comment` is exact. The remaining props are primitives / stable
// setters. This lets the bubble skip re-render on parent-render churn
// and on the periodic `teamMemberProfiles` context flip (the sender name
// now subscribes in its own `<ResolvedUserName>` leaf).
const areEqual = (prev: TaskCommentBubbleProps, next: TaskCommentBubbleProps): boolean =>
    prev.comment === next.comment &&
    prev.isFocused === next.isFocused &&
    prev.commentLink === next.commentLink &&
    prev.onCommentClick === next.onCommentClick &&
    prev.hostZIndex === next.hostZIndex &&
    prev.currentProjectId === next.currentProjectId &&
    prev.currentProjectName === next.currentProjectName &&
    prev.currentTaskDisplayId === next.currentTaskDisplayId &&
    prev.myself.userId === next.myself.userId;

export const TaskCommentBubble = memo(TaskCommentBubbleImpl, areEqual);
