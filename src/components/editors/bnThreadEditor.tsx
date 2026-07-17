import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useEffect, useRef, useState } from "react";
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

import { useAuth } from "../../context/AuthContext";
import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { getFirstLine } from "../../features/chat/utils/common";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useEditorDraft } from "../../hooks/common/useEditorDraft";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { channelService } from "../../services/channel/channelService";
import { emitRequestError } from "../../services/requestErrorNotifier";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadProps } from "../../types/chat";
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
import { GifToolbarButton } from "./GifToolbarButton";
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

// Chat attachment upload uses channelService.uploadInlineFile (v3); the
// legacy VITE_API_BASE_URL / VITE_DJANGO_URL upload consts were removed.

type BnThreadEditorProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    thread: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setCurrentChat: (chat: ChatProps) => void;
    useUISM: UIStateManagementState;
    numEditorLines: number;
    setNumEditorLines: (value: number) => void;
    useCM: ChatManagementState;
    pendingFiles?: File[];
    clearPendingFiles?: () => void;
};
export const BnThreadEditor = (props: BnThreadEditorProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        thread,
        setCurrentThreadChat,
        setCurrentChat,
        useUISM,
        setNumEditorLines,
        useCM,
        pendingFiles,
        clearPendingFiles,
    } = props;
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const urlLinkModal = useUrlLinkModal();
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);
    // Session-only wrap toggles. See `WrapToggleButtons` for the two
    // CSS classes added to the outer Box when each is on.
    const [unwrapAll, setUnwrapAll] = useState<boolean>(false);
    const [unwrapCode, setUnwrapCode] = useState<boolean>(false);
    const bnBoxClassName: string = [
        `bn-chat-editor-box-${mode}`,
        unwrapAll && "bn-unwrap-all",
        unwrapCode && "bn-unwrap-code",
    ]
        .filter(Boolean)
        .join(" ");

    const teamMembersRef = useRef(useTEM.teamMembers);
    const teamMemberProfilesRef = useRef(useTEM.teamMemberProfiles);
    useEffect(() => {
        teamMembersRef.current = useTEM.teamMembers;
        teamMemberProfilesRef.current = useTEM.teamMemberProfiles;
    }, [useTEM.teamMembers, useTEM.teamMemberProfiles]);

    // Disable the Audio and Image blocks from the built-in schema
    // This is done by picking out the blocks you want to disable
    const { audio, video, ...remainingBlockSpecs } = defaultBlockSpecs;

    const { mentionGroups } = useMentionGroupsContext();

    // Our schema with inline content specs, which contain the configs and
    // implementations for inline content  that we want our editor to use.
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
    ): DefaultReactSuggestionItem[] => getDefaultReactSlashMenuItems(editor);

    // See `bnChatEditor` for the rationale on `useUploadCounter`. Same
    // pattern: every uploadFile call ticks the counter so the in-editor
    // badge reflects in-flight work, and the `pendingFiles` loop below
    // also surfaces a blocking overlay with current/total progress.
    const { activeCount: editorUploadCount, wrap: trackUpload } = useUploadCounter();

    // Per-file size cap. See `bnChatEditor` for the rationale —
    // identical behaviour for thread-pane uploads.
    const { rejection, dismissRejection, filterFiles, guardUploadFile } = useFileSizeGuard();

    const uploadFile = guardUploadFile(
        trackUpload(async (file: File) => {
            // v3: compose-time inline upload via the channel-scoped uploader
            // (returns an absolute URL; no `django_url` prepend). Replaces
            // the deleted `/chat/attachment/` route.
            return channelService.uploadInlineFile(String(thread.chatId), file);
        })
    );

    // We use the English, default dictionary
    const locale = en;
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

    useEffect(() => {
        if (selectedEmoji !== null) {
            insertEmoji(selectedEmoji);
        }
    }, [selectedEmoji]);

    // Per-file progress for the thread-pane drop loop, mirroring the
    // chat editor.
    const [pendingUpload, setPendingUpload] = useState<{
        index: number;
        total: number;
        name: string;
    } | null>(null);

    // Process files dropped on the thread pane (outside the editor)
    useEffect(() => {
        if (pendingFiles && pendingFiles.length > 0 && clearPendingFiles) {
            // Drop oversize files up-front so the dim overlay only counts
            // files we'll actually try to upload.
            const acceptedFiles = filterFiles(pendingFiles);
            if (acceptedFiles.length === 0) {
                clearPendingFiles();
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
                            const url = await uploadFile(file);
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
                    setPendingUpload(null);
                    clearPendingFiles();
                }
            };
            insertFiles();
        }
    }, [pendingFiles]);

    const [editorDocLength, setEditorDocLength] = useState<number>(0);

    // Per-thread draft cache: see `useEditorDraft` for the
    // load/save/clear lifecycle. Keyed by chatType + chatId +
    // threadId so each thread keeps its own in-progress reply
    // separate from the parent chat's main-channel draft.
    const draftCacheKey =
        thread?.chatType != null && thread?.chatId != null && thread?.threadId != null
            ? `thread:${thread.chatType}:${thread.chatId}:${thread.threadId}`
            : null;
    const { saveDraft, clearDraft } = useEditorDraft(editor, draftCacheKey);

    const sendingThreadMessage = async () => {
        if (editor.document.length <= 1) return;
        // v3 cutover. The legacy `socket.emit("thread_message", POST,
        // ...)` + manual optimistic append + addThreadMessage IDB
        // write is replaced by `channelService.send(channelUuid,
        // body, {parentId: threadRootUuid, bodyText})`. The v3 backend:
        //
        //   1. Persists a `Message` row with `is_thread_reply=true`
        //      and `parent_id = threadRootUuid`.
        //   2. Increments the parent's `reply_count` atomically.
        //   3. Broadcasts `message.created` to the channel room.
        //
        // channelService.handleMessageCreated upserts the row into the
        // channel's `messagesByChannel` slice; the thread-pane
        // subscription in `useChatManagement` picks it up and patches
        // `currentThreadChat.messages` automatically. No optimistic
        // local state needed here.
        const content: any[] | any = editor.document;
        const bodyText: string = getFirstLine(content[0]);
        const channelUuid = String(thread.chatId);
        const threadRootUuid = String(thread.threadId);
        // Clear the composer immediately — don't freeze it on the server
        // round-trip (same fix as bnChatEditor; the previous code awaited
        // the send before clearing, holding the editor full for the full
        // ack latency, up to the backend's 10s Django timeout). The send
        // runs in the background.
        editor.replaceBlocks(editor.document, []);
        clearDraft();
        let sent = true;
        try {
            await channelService.send(channelUuid, content, {
                parentId: threadRootUuid,
                bodyText,
            });
        } catch (e) {
            console.error("[bnThreadEditor] channelService.send failed:", e);
            emitRequestError("messageSendFailed");
            sent = false;
        }
        // On failure (toast already surfaced), restore the text so it isn't
        // lost — but only if the user hasn't started a new message. Re-insert
        // a JSON deep-clone, matching how useEditorDraft restores a draft.
        if (!sent && editor.document.length <= 1) {
            try {
                editor.replaceBlocks(editor.document, JSON.parse(JSON.stringify(content)));
            } catch {
                /* stale block shape — nothing else we can do */
            }
        }
    };

    const countLines = (nodes: any[]): number => {
        let count = 0;
        for (const node of nodes) {
            count += 1; // count the current node itself
            if (node.children?.length) {
                count += countLines(node.children); // recursive call
            }
            if (node.content && node.content[0]) {
                if (node.content[0].text) {
                    count += node.content[0].text.split("\n").length;
                }
            }
            // Add 30 lines for each image to avoid scroll issues.
            if (node.type === "image") {
                count += 10;
            }
        }
        return count;
    };

    return (
        <Box>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            <EmojiPicker
                setSelectedEmoji={setSelectedEmoji}
                setShowEmojiPicker={setShowEmojiPicker}
                showEmojiPicker={showEmojiPicker}
            />
            <GifPicker
                setShowGifPicker={setShowGifPicker}
                showGifPicker={showGifPicker}
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
                    formattingToolbar={false}
                    sideMenu={false} // false for Chat/comment, true for Task content
                    theme={mode === "dark" ? "dark" : "light"}
                    data-changing-font-demo // custom font
                    onChange={() => {
                        const comments: any[] = editor.document;
                        setNumEditorLines(countLines(comments));
                        setEditorDocLength(editor.document.length);
                        saveDraft(editor.document);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            sendingThreadMessage();
                        }
                    }}
                >
                    <EditorSendButton
                        disabled={editorDocLength < 2}
                        onSend={sendingThreadMessage}
                    />

                    <Box
                        className="bn-editor-toolbar"
                        sx={{
                            position: "absolute",
                            top: "1%",
                            left: "0.5%",
                            zIndex: 1,
                            p: 0.7,
                        }}
                    >
                        <FormattingToolbar>
                            <BlockTypeSelect
                                key={"blockTypeSelect"}
                                items={getBlockTypeSelectItemsWithCodeBlock(editor.dictionary)}
                            />

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
                            <FileCaptionButton key={"fileCaptionButton"} />
                            <FileReplaceButton key={"replaceFileButton"} />
                            <FileDeleteButton key={"fileDeleteButton"} />
                            <FileDownloadButton key={"fileDownloadButton"} />
                            <FilePreviewButton key={"filePreviewButton"} />
                            <FileRenameButton key={"fileRenameButton"} />

                            {/* Extra button to toggle blue text & background */}
                            {!isMobile && (
                                <CustomEmojiToolbar
                                    key={"customButton"}
                                    setShowEmojiPicker={setShowEmojiPicker}
                                />
                            )}
                            {!isMobile && (
                                <GifToolbarButton
                                    key={"gifButton"}
                                    setShowGifPicker={setShowGifPicker}
                                />
                            )}
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
                            filterAndRankSuggestionItems(
                                MentionMenuItems(
                                    teamMemberProfilesRef.current,
                                    editor,
                                    teamMembersRef.current,
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
