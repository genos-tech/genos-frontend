import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "../../App.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { withTrailingBlank } from "./utils/messageBlocks";

import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { emitTaskTouched } from "../../features/tasks/services/taskEvents";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { TaskCommentProps, TaskProps } from "../../types/tasks";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
import { FileSizeRejectionSnackbar } from "../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadOverlay, FileUploadStatusBadge } from "../ui/feedback/FileUploadProgress";
import { GifPicker } from "../ui/gif/GifPicker";
import { useBlockNoteDictionary } from "./blockNoteI18n";
import { useChatComposer } from "./composer/useChatComposer";
import { insertEmojiValue } from "./CustomEmoji";
import { useGenosSchema } from "./genos/genosSchema";
import { GenosSuggestionMenus } from "./genos/GenosSuggestionMenus";
import { GenosChatToolbar } from "./genos/GenosToolbars";
import { EditorSendButton } from "./sub/EditorSendButton";

type BnTaskCommentEditorProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    task: TaskProps;
    setTaskUpdated?: (value: boolean) => void;
    taskComments: TaskCommentProps[];
    setTaskComments: (value: TaskCommentProps[]) => void;
    useUISM: UIStateManagementState;
    taskCommentLines: number;
    setTaskCommentLines: (value: number) => void;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    /** v3 channel to upload inline image/file blocks against — the
     *  task's project PM channel. When unset (task without a project /
     *  PM channel not loaded), BlockNote gets no `uploadFile` and file
     *  inserts are unavailable; drops are then handled by the caller's
     *  fallback (attach to the task's Attachments tab). */
    uploadChannelId?: string;
    /** Files dropped on the comment tab (outside the editor itself).
     *  Uploaded in series and inserted as image/file blocks — same
     *  contract as BnChatEditor's chat-pane drop flow. */
    pendingFiles?: File[];
    clearPendingFiles?: () => void;
};

export const BnTaskCommentEditor = (props: BnTaskCommentEditorProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        task,
        setTaskUpdated,
        taskComments,
        setTaskComments,
        useUISM,
        taskCommentLines,
        setTaskCommentLines,
        useCM,
        useTM,
        uploadChannelId,
        pendingFiles,
        clearPendingFiles,
    } = props;
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const urlLinkModal = useUrlLinkModal();
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);
    // Session-only wrap toggles. See `WrapToggleToolbarButtons`.
    const [unwrapAll, setUnwrapAll] = useState<boolean>(false);
    const [unwrapCode, setUnwrapCode] = useState<boolean>(false);
    const bnBoxClassName: string = [
        `bn-task-comment-box-${mode}`,
        unwrapAll && "bn-unwrap-all",
        unwrapCode && "bn-unwrap-code",
    ]
        .filter(Boolean)
        .join(" ");

    // The shared Genos schema (`genos/genosSchema.ts`), built once per mount:
    // `useCreateBlockNote` keeps the first schema it is given.
    const { mentionGroups } = useMentionGroupsContext();

    const schema = useGenosSchema(
        {
            teamMemberProfiles: useTEM.teamMemberProfiles,
            socket,
            myself,
            setMyself,
            useUISM,
            useCM,
        },
        "mount"
    );

    const dictionary = useBlockNoteDictionary();

    const [numEditorLines, setNumEditorLines] = useState<number>(0);

    // Upload pipeline, drop queue, draft, canSend and the send flow are the shared composer
    // hook's (see `composer/useChatComposer`).
    //
    // Send a new comment.
    //
    // Old behaviour deferred BOTH the optimistic list-append AND the
    // editor-clear to a side effect that listened for
    // `useTM.isTaskCommentUpdated.isUpdate === true`. That flag flips
    // when the server broadcasts the `wsType === "task"` round-trip;
    // unfortunately, the round-trip races with React render passes and
    // — in some host configurations — never reaches this component
    // before the user clicks again. The visible symptom was: comment
    // is persisted in DB, but the editor stays full and the list stays
    // stale until the page is refreshed.
    //
    // The fix is to make this path purely user-driven:
    //   1. The hook snapshots the editor content while it's still valid and
    //      clears the editor *now*.
    //   2. `submit` optimistically appends to `taskComments` so the list
    //      updates *now*.
    //   3. Emit the socket events.
    //   4. Bump `useTM.isTaskCommentUpdated` so other consumers
    //      (TaskPreview's load effect, ThreadCommentsView's load
    //      effect) refetch and replace the optimistic row with server
    //      truth — covering reconciled timestamps / commentId /
    //      mentions etc.
    const composer = useChatComposer({
        schema,
        dictionary,
        // Inline uploads are channel-scoped in v3; task comments ride the
        // task's project PM channel. Without a resolvable channel there is
        // no `uploadFile`, so BlockNote's own file insert paths stay inert.
        uploads: { channelId: uploadChannelId ? String(uploadChannelId) : undefined },
        // Files dropped on the comment tab (outside the editor itself). The queue is claimed
        // first and the loop skips the counter and the size guard's wrapper, as it always did.
        dropQueue: { files: pendingFiles, clear: clearPendingFiles },
        // Per-task draft cache. The hook tracks the previously-loaded key internally and won't
        // clobber the editor on re-renders where `task` is recreated but `task.id` is unchanged.
        draftKey: task?.id != null ? `task-comment:${task.id}` : null,
        onLinesChange: setNumEditorLines,
        canSubmit: () => !!socket && !!task.id,
        submit: (blocks) => {
            // Stored with the trailing blank line every reader expects (MIP-1039).
            const commentBodySnapshot = withTrailingBlank(blocks);

            const optimistic = {
                projectId: task.project?.projectId || null,
                taskId: task.id as number, // `canSubmit` guarantees an id
                senderId: myself.userId,
                senderName: myself.userName,
                commentId: taskComments.length + 1,
                commentBody: commentBodySnapshot,
                tsSent: getLocalCurrentTimestamp(),
                tsUpdated: getLocalCurrentTimestamp(),
                isEdited: false,
            };

            setTaskComments([...taskComments, optimistic]);
            setNumEditorLines(0);

            socket!.emit(
                "task_comment",
                {
                    method_type: "POST",
                    project_id: task.project?.projectId,
                    project_name: task.project?.projectName,
                    task_id: task.id,
                    display_id: task.displayId,
                    comment_body: commentBodySnapshot,
                    is_private: task.project?.isPrivate || false,
                },
                () => {
                    // Round-trip done: ask the rest of the app to refetch
                    // so the optimistic row is replaced with the canonical
                    // server payload (correct commentId, ts, mentions…).
                    useTM.setIsTaskCommentUpdated({ isUpdate: true, scrollToBottom: true });
                    emitTaskTouched(Number(task.id), "comment");
                    // (Removed a dead `thread_message` emit that used to bump the
                    // PM bubble's comment-count chip: its Flask handler was
                    // dropped in the v3 migration, so it posted nowhere. The chip
                    // now reads the server-computed `taskCommentCount`, refreshed
                    // by the `task_comment` broadcast + this `task-touched` event.)
                }
            );
        },
    });
    const { editor } = composer;

    const boxRef = useRef<HTMLDivElement>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [showGifPicker, setShowGifPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const insertEmoji = (emoji: any) => {
        // ":name:" shortcodes from the picker's Team Emoji category
        // become customEmoji inline nodes; unicode stays plain text.
        insertEmojiValue(editor, emoji);
        setShowEmojiPicker(false);
    };
    const insertGif = (gif: { url: string; title: string }) => {
        // Standard image block: every read surface already renders and
        // animates it (same path as an uploaded GIF file).
        editor.insertBlocks(
            [{ type: "image", props: { url: gif.url, name: gif.title } }],
            editor.getTextCursorPosition().block,
            "after"
        );
        setShowGifPicker(false);
    };

    // Mirror the local line count back up to the task page so the
    // parent's sticky-comment chip can react. Height is no longer
    // computed here — the editor auto-sizes inside its CSS min/max
    // bounds and the comment list flexes above it.
    useEffect(() => {
        if (numEditorLines !== taskCommentLines) {
            setTaskCommentLines(numEditorLines);
        }
    }, [numEditorLines]);

    useEffect(() => {
        if (selectedEmoji !== null) {
            insertEmoji(selectedEmoji);
        }
    }, [selectedEmoji]);

    // Picker is rendered via portal into document.body with position:fixed so it
    // can never be clipped by an overflow:hidden ancestor and always stacks on top.
    // We anchor its viewport coordinates so it sits directly ABOVE the comment
    // editor box, with safe-area clamping to keep it inside the window.
    const PICKER_WIDTH = 360;
    const PICKER_HEIGHT = 440;
    const PICKER_MARGIN = 8;
    const [pickerTopPosition, setPickerTopPosition] = useState<number>(0);
    const [pickerLeftPosition, setPickerLeftPosition] = useState<number>(0);

    const updatePickerPosition = useCallback(() => {
        if (!boxRef.current) return;
        const rect = boxRef.current.getBoundingClientRect();
        const top = Math.max(PICKER_MARGIN, rect.top - PICKER_HEIGHT - PICKER_MARGIN);
        const maxLeft = Math.max(PICKER_MARGIN, window.innerWidth - PICKER_WIDTH - PICKER_MARGIN);
        const left = Math.min(Math.max(PICKER_MARGIN, rect.left), maxLeft);
        setPickerTopPosition(top);
        setPickerLeftPosition(left);
    }, []);

    useEffect(() => {
        if (!showEmojiPicker && !showGifPicker) return;
        updatePickerPosition();
        window.addEventListener("resize", updatePickerPosition);
        // Use capture so we catch scrolls inside any scrollable ancestor too.
        window.addEventListener("scroll", updatePickerPosition, true);
        return () => {
            window.removeEventListener("resize", updatePickerPosition);
            window.removeEventListener("scroll", updatePickerPosition, true);
        };
    }, [showEmojiPicker, showGifPicker, updatePickerPosition]);

    return (
        <Box ref={boxRef}>
            <FileSizeRejectionSnackbar
                rejection={composer.rejection}
                onDismiss={composer.dismissRejection}
            />
            {/* Hidden native picker for the mobile "attach image/file"
                toolbar button. Rendered unconditionally; only the button
                that clicks it is mobile-gated (and requires an upload
                channel). */}
            <input
                ref={composer.attachInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={composer.onAttachInputChange}
            />
            <EmojiPicker
                pickerBottomPosition="auto"
                pickerLeftPosition={pickerLeftPosition}
                pickerRightPosition="auto"
                pickerTopPosition={pickerTopPosition}
                setSelectedEmoji={setSelectedEmoji}
                setShowEmojiPicker={setShowEmojiPicker}
                showEmojiPicker={showEmojiPicker}
                useFixedPosition={true}
            />
            <GifPicker
                pickerBottomPosition="auto"
                pickerLeftPosition={pickerLeftPosition}
                pickerRightPosition="auto"
                pickerTopPosition={pickerTopPosition}
                setShowGifPicker={setShowGifPicker}
                showGifPicker={showGifPicker}
                useFixedPosition={true}
                onSelect={insertGif}
            />
            <Box ref={editorBoxRef} className={bnBoxClassName} sx={{ position: "relative" }}>
                <FileUploadStatusBadge count={composer.editorUploadCount} />
                <FileUploadOverlay
                    label={t.common.ui.fileUpload.uploadingDroppedFiles}
                    open={composer.overlay.open}
                    detail={composer.overlay.detail}
                />
                <BlockNoteView
                    className="bn-box"
                    editor={editor}
                    emojiPicker={false}
                    // A custom "/" SuggestionMenuController is mounted below —
                    // the built-in menu must be off or BOTH render on "/",
                    // stacking duplicate group labels (the "Media x3" bug).
                    slashMenu={false}
                    formattingToolbar={false}
                    sideMenu={false} // false for Chat/comment, true for Task content
                    theme={mode === "dark" ? "dark" : "light"}
                    data-changing-font-demo // custom font
                    onBlur={() => {
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    }}
                    onChange={composer.viewProps.onChange}
                    onKeyDown={composer.viewProps.onKeyDown}
                >
                    <EditorSendButton disabled={composer.sendDisabled} onSend={composer.send} />

                    <Box
                        className="bn-editor-toolbar"
                        sx={{
                            position: "absolute",
                            // `top: "1%"` resolved against the editor box, so
                            // on a phone the bar started ~3px down and its
                            // ~47px height ran past the content's 40px
                            // `padding-top` — covering the first line you
                            // typed. Flush to the top on mobile, with a
                            // tighter inner pad so the bar is shorter than
                            // the padding that clears it (see App.css).
                            top: { xs: 0, md: "1%" },
                            left: { xs: 0, md: "0.5%" },
                            zIndex: 1,
                            p: { xs: 0.25, md: 0.7 },
                        }}
                    >
                        <GenosChatToolbar
                            editor={editor}
                            isMobile={isMobile}
                            setShowEmojiPicker={setShowEmojiPicker}
                            setShowGifPicker={setShowGifPicker}
                            onAttach={composer.openAttach}
                            wrapToggles={{ unwrapAll, setUnwrapAll, unwrapCode, setUnwrapCode }}
                        />
                    </Box>

                    <GenosSuggestionMenus
                        editor={editor}
                        getMentionSources={() => ({
                            teamMemberProfiles: useTEM.teamMemberProfiles,
                            teamMembers: useTEM.teamMembers,
                            myselfUserId: myself.userId,
                            mentionGroups,
                        })}
                        slash={{ preset: "chat", setShowGifPicker }}
                    />
                </BlockNoteView>
            </Box>
        </Box>
    );
};
