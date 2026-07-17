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
import { sendChatMessage } from "../../features/chat/services/sendChatMessage";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useEditorDraft } from "../../hooks/common/useEditorDraft";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { channelService } from "../../services/channel/channelService";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
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

// Chat attachment upload uses channelService.uploadInlineFile (v3); the
// legacy VITE_API_BASE_URL / VITE_DJANGO_URL upload consts were removed.

type BnChatEditorProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    chat: ChatProps;
    setCurrentChat: (chat: ChatProps) => void;
    useUISM: UIStateManagementState;
    numEditorLines: number;
    setNumEditorLines: (value: number) => void;
    pendingFiles?: File[];
    clearPendingFiles?: () => void;
};
export const BnChatEditor = (props: BnChatEditorProps) => {
    const {
        useTEM,
        useCM,
        myself,
        setMyself,
        socket,
        chat,
        setCurrentChat,
        useUISM,
        setNumEditorLines,
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
    // The `with-subchat` modifier tightens the editor's max-height in
    // App.css when the split sub-chat pane is open, so the two stacked
    // editors don't collectively eat the message-list area.
    const bnBoxClassName: string = [
        `bn-chat-editor-box-${mode}`,
        useCM.isSubChatVisible && "with-subchat",
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

    // Mention groups — sourced from the App-root provider so every
    // editor instance shares one fetch.
    const { mentionGroups } = useMentionGroupsContext();
    const mentionGroupsRef = useRef(mentionGroups);
    useEffect(() => {
        mentionGroupsRef.current = mentionGroups;
    }, [mentionGroups]);

    // Disable the Audio and Image blocks from the built-in schema
    // This is done by picking out the blocks you want to disable
    const { audio, video, ...remainingBlockSpecs } = defaultBlockSpecs;

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
    ): DefaultReactSuggestionItem[] =>
        withGifSlashItem(getDefaultReactSlashMenuItems(editor), setShowGifPicker);

    // Counter wraps every `uploadFile` call so the small "Uploading n
    // files…" pill at the top of the editor reflects in-flight work
    // both for slash-menu / drag-into-editor inserts (BlockNote calls
    // `uploadFile` directly) and the `pendingFiles` loop below. Large
    // files routinely take several seconds and BlockNote's own in-block
    // placeholder isn't always obvious, so the pill plugs that gap.
    const { activeCount: editorUploadCount, wrap: trackUpload } = useUploadCounter();

    // Per-file size cap. `guardUploadFile` rejects oversize files
    // before any fetch happens (so BlockNote's slash-menu / drag
    // inserts and the `pendingFiles` loop both bail out cheaply) and
    // surfaces a friendly toast via the snackbar rendered below.
    const { rejection, dismissRejection, filterFiles, guardUploadFile } = useFileSizeGuard();

    const uploadFile = guardUploadFile(
        trackUpload(async (file: File) => {
            // v3: compose-time inline upload via the channel-scoped uploader.
            // The legacy `/chat/attachment/` route was removed in the v3
            // cutover; `uploadInlineFile` returns an absolute URL that
            // BlockNote embeds directly (no `django_url` host prepend).
            return channelService.uploadInlineFile(String(chat.chatId), file);
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

    // Tracks the chat-pane drop upload loop (separate from BlockNote's
    // own `uploadFile` placeholder) so the editor surface can show a
    // dim overlay with "Uploading 2 / 5 — large.pdf" text. Without this
    // the user sees nothing for several seconds while large files
    // POST in series, then the blocks suddenly appear.
    const [pendingUpload, setPendingUpload] = useState<{
        index: number;
        total: number;
        name: string;
    } | null>(null);

    // Process files dropped on the chat pane (outside the editor)
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

    // Restore (or clear) the editor when the user navigates between
    // chats, and persist unsent typing as a per-chat draft. See
    // `useEditorDraft` for the load/save/clear lifecycle.
    const draftCacheKey =
        chat?.chatId != null && chat?.chatType != null
            ? `chat:${chat.chatType}:${chat.chatId}`
            : null;
    const { saveDraft, clearDraft } = useEditorDraft(editor, draftCacheKey);

    const sendingMessage = async () => {
        if (editor.document.length > 1 && socket !== null) {
            // Capture the message, then clear the composer IMMEDIATELY —
            // don't freeze it on the server round-trip. The previous
            // `await sendChatMessage(...)` BEFORE clearing held the editor
            // full for the entire ack latency (up to the backend's 10s
            // Django read-timeout); the send now runs in the background.
            const content = editor.document;
            editor.replaceBlocks(editor.document, []);
            clearDraft();
            const sent = await sendChatMessage({
                socket,
                chat,
                content,
                myself,
                useCM,
                setCurrentChat,
            });
            // On failure (sendChatMessage has already surfaced a toast),
            // put the text back so it isn't lost — but only if the user
            // hasn't started a new message meanwhile. Re-insert a JSON
            // deep-clone, NOT the live block objects we just removed: that
            // mirrors exactly how useEditorDraft restores a draft from
            // storage (deserialized blocks), the path BlockNote re-hydrates
            // cleanly on every chat switch, so there's no id-reuse rejection.
            if (!sent && editor.document.length <= 1) {
                try {
                    editor.replaceBlocks(editor.document, JSON.parse(JSON.stringify(content)));
                } catch {
                    /* stale block shape — nothing else we can do */
                }
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
            {/* Anchored so the picker's bottom edge sits right on the
                editor's top edge (the zero-height wrapper renders directly
                above the editor box) instead of floating over the list. */}
            <EmojiPicker
                pickerBottomPosition={4}
                pickerLeftPosition={8}
                setSelectedEmoji={setSelectedEmoji}
                setShowEmojiPicker={setShowEmojiPicker}
                showEmojiPicker={showEmojiPicker}
            />
            <GifPicker
                pickerBottomPosition={4}
                pickerLeftPosition={8}
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
                    // A custom "/" SuggestionMenuController is mounted below —
                    // the built-in menu must be off or BOTH render on "/",
                    // stacking duplicate group labels (the "Media x3" bug).
                    slashMenu={false}
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
                    onKeyDown={async (event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            sendingMessage();
                        }
                    }}
                >
                    <EditorSendButton
                        disabled={editorDocLength < 2}
                        onSend={() => {
                            void sendingMessage();
                        }}
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
                            <BasicTextStyleButton
                                key={"codeStyleButton"}
                                basicTextStyle={"code"}
                            />

                            <ColorStyleButton key={"colorStyleButton"} />
                            {/* Link + Emoji buttons are hidden on
                                mobile — the toolbar is positioned
                                absolutely (fixed width) and clipping
                                the tail off-screen on narrow viewports.
                                Slash-command alternatives still work:
                                paste-as-link works inline; the "/" menu
                                offers Emoji. */}
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
                                    mentionGroupsRef.current
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
