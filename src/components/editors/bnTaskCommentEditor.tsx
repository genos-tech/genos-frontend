import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "../../App.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { codeBlockOptions } from "@blocknote/code-block";
import {
    BlockNoteSchema,
    createCodeBlockSpec,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
    filterSuggestionItems,
} from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import {
    BasicTextStyleButton,
    BlockTypeSelect,
    ColorStyleButton,
    CreateLinkButton,
    DefaultReactSuggestionItem,
    FileCaptionButton,
    FileDeleteButton,
    FileDownloadButton,
    FilePreviewButton,
    FileRenameButton,
    FileReplaceButton,
    FormattingToolbar,
    getDefaultReactSlashMenuItems,
    SuggestionMenuController,
    useCreateBlockNote,
} from "@blocknote/react";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { emitTaskTouched } from "../../features/tasks/services/taskEvents";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useEditorDraft } from "../../hooks/common/useEditorDraft";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { useTranslation } from "../../i18n";
import { channelService } from "../../services/channel/channelService";
import { UserProps } from "../../types/admin";
import { TaskCommentProps, TaskProps } from "../../types/tasks";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { resolveInsecureFileUrl } from "../../utils/downloadUtils";
import { filterAndRankSuggestionItems } from "../../utils/suggestionRanking";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
import { FileSizeRejectionSnackbar } from "../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadOverlay, FileUploadStatusBadge } from "../ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../ui/feedback/useFileSizeGuard";
import { useUploadCounter } from "../ui/feedback/useUploadCounter";
import { GifPicker } from "../ui/gif/GifPicker";
import { CreateCustomEmojiSpec, insertEmojiValue } from "./CustomEmoji";
import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { getEmojiSuggestionItems } from "./EmojiSuggestion";
import { GifToolbarButton, withGifSlashItem } from "./GifToolbarButton";
import {
    CreateHashChatSpec,
    CreateHashNoteSpec,
    CreateHashProjectSpec,
    CreateHashTaskSpec,
    HashSuggestionMenuController,
} from "./HashMention";
import {
    CreateMentionGroupSpec,
    CreateMentionSpec,
    MentionMenuItems,
    MentionSuggestionMenu,
} from "./Mention";
import {
    codeBlockEnterShortcut,
    getBlockTypeSelectItemsWithCodeBlock,
} from "./sub/codeBlockExtras";
import { EditorSendButton } from "./sub/EditorSendButton";
import { WrapToggleToolbarButtons } from "./sub/WrapToggleToolbarButtons";

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

    // Disable only the Audio and Video blocks from the built-in schema.
    // Image + File stay in (same set as BnChatEditor) so files dropped
    // on the comment tab can ride inside the comment body itself —
    // TaskCommentBubble renders comments through BnChatPreview, which
    // already displays both block types.
    const { audio, video, ...remainingBlockSpecs } = defaultBlockSpecs;

    // Our schema with inline content specs, which contain the configs and
    // implementations for inline content  that we want our editor to use.
    const { mentionGroups } = useMentionGroupsContext();

    const schema = BlockNoteSchema.create({
        inlineContentSpecs: {
            // Adds all default inline content.
            ...defaultInlineContentSpecs,
            // Adds the mention tag.
            mention: CreateMentionSpec(
                useTEM.teamMemberProfiles,
                socket,
                myself,
                setMyself,
                useUISM,
                useCM
            ),
            mentionGroup: CreateMentionGroupSpec(),
            customEmoji: CreateCustomEmojiSpec(),
            hashTask: CreateHashTaskSpec(),
            hashNote: CreateHashNoteSpec(),
            hashChat: CreateHashChatSpec(),
            hashProject: CreateHashProjectSpec(),
        },
        blockSpecs: {
            // remainingBlockSpecs contains all the other blocks
            ...remainingBlockSpecs,
            // BlockNote 0.49 moved the code-block options out of
            // `useCreateBlockNote` and into the schema. We override
            // the default plain-text codeBlock with the syntax-
            // highlighted one shipped by `@blocknote/code-block`.
            codeBlock: createCodeBlockSpec(codeBlockOptions),
        },
    });

    // List containing all default Slash Menu Items, as well as our custom one.
    const getCustomSlashMenuItems = (
        editor: typeof schema.BlockNoteEditor
    ): DefaultReactSuggestionItem[] =>
        withGifSlashItem(getDefaultReactSlashMenuItems(editor), setShowGifPicker);

    // We use the English, default dictionary
    const locale = en;

    // Upload pipeline — mirrors BnChatEditor: the counter drives the
    // "Uploading n files…" pill for BlockNote-initiated uploads
    // (slash-menu / drag straight into the editor), the size guard
    // rejects oversize files before any fetch and feeds the snackbar.
    const { activeCount: editorUploadCount, wrap: trackUpload } = useUploadCounter();
    const { rejection, dismissRejection, filterFiles, guardUploadFile } = useFileSizeGuard();

    // Inline uploads are channel-scoped in v3; task comments ride the
    // task's project PM channel. Without a resolvable channel there is
    // no `uploadFile`, so BlockNote's own file insert paths stay inert.
    const uploadFile = uploadChannelId
        ? guardUploadFile(
              trackUpload(async (file: File) =>
                  channelService.uploadInlineFile(String(uploadChannelId), file)
              )
          )
        : undefined;

    const editor = useCreateBlockNote({
        schema,
        resolveFileUrl: resolveInsecureFileUrl,
        uploadFile,
        // `codeBlockEnterShortcut` augments the built-in
        // ``` + Space input rule with an Enter-key handler, so
        // users get the same Markdown shortcut they expect.
        extensions: [codeBlockEnterShortcut],
        // We override the `placeholders` in our dictionary
        dictionary: {
            ...locale,
            placeholders: {
                ...locale.placeholders,
                // We override the empty document placeholder
                emptyDocument: "Start typing...",
                // We override the default placeholder
                default: "Type something...",
                // We override the heading placeholder
                heading: "Custom heading placeholder",
            },
        },
    });

    // Per-task draft cache: see `useEditorDraft` for the
    // load/save/clear lifecycle. Replaces the old `prevTaskIdRef`
    // bookkeeping — the hook tracks the previously-loaded key
    // internally and won't clobber the editor on re-renders where
    // `task` is recreated but `task.id` is unchanged.
    const draftCacheKey = task?.id != null ? `task-comment:${task.id}` : null;
    const { saveDraft, clearDraft } = useEditorDraft(editor, draftCacheKey);

    // Tracks the comment-tab drop upload loop (separate from BlockNote's
    // own `uploadFile` placeholder) so the editor surface can show a dim
    // overlay with "Uploading 2 / 5 — large.pdf" while files POST in
    // series. Same UX as BnChatEditor's chat-pane drop.
    const [pendingUpload, setPendingUpload] = useState<{
        index: number;
        total: number;
        name: string;
    } | null>(null);

    // Process files dropped on the comment tab (outside the editor).
    useEffect(() => {
        if (!pendingFiles || pendingFiles.length === 0 || !clearPendingFiles) return;
        // Capture + clear the queue SYNCHRONOUSLY, before any await.
        // Clearing in a `finally` (the chat editor's shape) leaves the
        // parent's queue populated for the whole upload; if this editor
        // remounts meanwhile (tab switch, edit-mode toggle), the fresh
        // mount would re-run this effect against the same array and
        // insert every file a second time.
        const queued = pendingFiles;
        clearPendingFiles();
        if (!uploadChannelId) {
            // No upload channel — the caller shouldn't have forwarded the
            // drop here (its fallback attaches to the Attachments tab).
            return;
        }
        // Drop oversize files up-front so the dim overlay only counts
        // files we'll actually try to upload.
        const acceptedFiles = filterFiles(queued);
        if (acceptedFiles.length === 0) {
            return;
        }
        const insertFiles = async () => {
            try {
                for (let i = 0; i < acceptedFiles.length; i += 1) {
                    const file = acceptedFiles[i];
                    setPendingUpload({
                        index: i + 1,
                        total: acceptedFiles.length,
                        name: file.name,
                    });
                    try {
                        const url = await channelService.uploadInlineFile(
                            String(uploadChannelId),
                            file
                        );
                        const isImage = file.type.startsWith("image/");
                        editor.insertBlocks(
                            [
                                isImage
                                    ? { type: "image", props: { url, name: file.name } }
                                    : { type: "file", props: { url, name: file.name } },
                            ],
                            editor.document[editor.document.length - 1],
                            "after"
                        );
                    } catch (err) {
                        console.error("Failed to insert dropped file:", err);
                    }
                }
            } finally {
                // Queue was already cleared synchronously above — only
                // the overlay needs tearing down here.
                setPendingUpload(null);
            }
        };
        void insertFiles();
    }, [pendingFiles]);

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

    const countLines = (nodes: any[]): number => {
        let count = 0;
        for (const node of nodes) {
            count += 1; // count the current node itself
            if (node.children?.length) {
                count += countLines(node.children); // recursive call
            }
            // Guarded: image/file blocks carry no `content` array.
            if (node.content && node.content[0]) {
                if (node.content[0].text) {
                    count += node.content[0].text.split("\n").length;
                }
            }
            // Add lines for each image to avoid scroll issues (same
            // heuristic as BnChatEditor).
            if (node.type === "image") {
                count += 10;
            }
        }
        return count;
    };

    const [editorDocLength, setEditorDocLength] = useState<number>(0);
    const [numEditorLines, setNumEditorLines] = useState<number>(0);

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
    //   1. Snapshot the editor content while it's still valid.
    //   2. Optimistically append to `taskComments` so the list updates
    //      *now*.
    //   3. Clear the editor *now*.
    //   4. Emit the socket events.
    //   5. Bump `useTM.isTaskCommentUpdated` so other consumers
    //      (TaskPreview's load effect, ThreadCommentsView's load
    //      effect) refetch and replace the optimistic row with server
    //      truth — covering reconciled timestamps / commentId /
    //      mentions etc.
    const sendComment = async () => {
        if (!socket) return;
        if (editor.document.length <= 1) return;
        if (!task.id) return;

        const commentBodySnapshot = editor.document;

        const optimistic = {
            projectId: task.project?.projectId || null,
            taskId: task.id,
            senderId: myself.userId,
            senderName: myself.userName,
            commentId: taskComments.length + 1,
            commentBody: commentBodySnapshot,
            tsSent: getLocalCurrentTimestamp(),
            tsUpdated: getLocalCurrentTimestamp(),
            isEdited: false,
        };

        setTaskComments([...taskComments, optimistic]);
        editor.replaceBlocks(editor.document, []);
        clearDraft();
        setEditorDocLength(0);
        setNumEditorLines(0);

        socket.emit(
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
            (_ack: any) => {
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
    };

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
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
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
                <FileUploadStatusBadge count={editorUploadCount} />
                <FileUploadOverlay
                    label={t.common.ui.fileUpload.uploadingDroppedFiles}
                    open={pendingUpload !== null}
                    detail={
                        pendingUpload
                            ? `${pendingUpload.name} (${pendingUpload.index} / ${pendingUpload.total})`
                            : undefined
                    }
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
                    onChange={() => {
                        const comments: any[] = editor.document;
                        setNumEditorLines(countLines(comments));
                        setEditorDocLength(editor.document.length);
                        saveDraft(editor.document);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            sendComment();
                        }
                    }}
                >
                    <EditorSendButton disabled={editorDocLength < 2} onSend={sendComment} />

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
                        <FormattingToolbar>
                            {/* The block-type picker ("Paragraph" + a
                                dropdown of headings / lists) is the widest
                                item in the bar by far, and heading-styled
                                chat messages aren't a thing people reach for
                                on a phone. Dropping it on mobile is what
                                buys room for Emoji and GIF below; the "/"
                                menu still offers every block type. */}
                            {!isMobile && (
                                <BlockTypeSelect
                                    key={"blockTypeSelect"}
                                    items={getBlockTypeSelectItemsWithCodeBlock(editor.dictionary)}
                                />
                            )}

                            <FileCaptionButton key={"fileCaptionButton"} />
                            <FileReplaceButton key={"replaceFileButton"} />
                            <FileDeleteButton key={"fileDeleteButton"} />
                            <FileDownloadButton key={"fileDownloadButton"} />
                            <FilePreviewButton key={"filePreviewButton"} />
                            <FileRenameButton key={"fileRenameButton"} />

                            <BasicTextStyleButton
                                key={"boldStyleButton"}
                                basicTextStyle={"bold"}
                            />
                            <BasicTextStyleButton
                                key={"italicStyleButton"}
                                basicTextStyle={"italic"}
                            />
                            <BasicTextStyleButton
                                key={"underlineStyleButton"}
                                basicTextStyle={"underline"}
                            />
                            <BasicTextStyleButton
                                key={"strikeStyleButton"}
                                basicTextStyle={"strike"}
                            />
                            {/* Extra button to toggle code styles */}
                            <BasicTextStyleButton
                                key={"codeStyleButton"}
                                basicTextStyle={"code"}
                            />

                            <ColorStyleButton key={"colorStyleButton"} />
                            {/* Link + Emoji buttons hidden on mobile —
                                the toolbar is absolutely-positioned and
                                clips the tail off-screen on narrow
                                viewports. The "/" slash menu still
                                exposes both. */}
                            {!isMobile && <CreateLinkButton key={"createLinkButton"} />}

                            {/* Emoji + GIF now render at EVERY width. They
                                were mobile-hidden because the bar clipped
                                off-screen — that was the block-type picker's
                                width; with it gone these two fit, and they're
                                the two people actually want on a comment. */}
                            <CustomEmojiToolbar
                                key={"customButton"}
                                setShowEmojiPicker={setShowEmojiPicker}
                            />
                            <GifToolbarButton
                                key={"gifButton"}
                                setShowGifPicker={setShowGifPicker}
                            />
                            {/* Session-only wrap toggles — hidden on
                                mobile because the toolbar already
                                clips off-screen on narrow viewports. */}
                            {!isMobile && (
                                <WrapToggleToolbarButtons
                                    key={"wrapToggleButtons"}
                                    setUnwrapAll={setUnwrapAll}
                                    setUnwrapCode={setUnwrapCode}
                                    unwrapAll={unwrapAll}
                                    unwrapCode={unwrapCode}
                                />
                            )}
                        </FormattingToolbar>
                    </Box>

                    {/* "#" mentions: tasks / notes / GM chats / projects */}
                    <HashSuggestionMenuController editor={editor} />
                    {/* Adds a mentions menu which opens with the "@" key */}
                    <SuggestionMenuController
                        suggestionMenuComponent={MentionSuggestionMenu}
                        triggerCharacter={"@"}
                        getItems={async (query) =>
                            // Gets the mentions menu items
                            filterAndRankSuggestionItems(
                                MentionMenuItems(
                                    useTEM.teamMemberProfiles,
                                    editor,
                                    useTEM.teamMembers,
                                    myself.userId,
                                    mentionGroups
                                ),
                                query
                            )
                        }
                    />
                    <SuggestionMenuController
                        triggerCharacter={"/"}
                        // Replaces the default Slash Menu items with our custom ones.
                        getItems={async (query) =>
                            filterSuggestionItems(getCustomSlashMenuItems(editor), query)
                        }
                    />
                    <SuggestionMenuController
                        getItems={async (query) => getEmojiSuggestionItems(editor, query)}
                        minQueryLength={2}
                        triggerCharacter={":"}
                    />
                </BlockNoteView>
            </Box>
        </Box>
    );
};
