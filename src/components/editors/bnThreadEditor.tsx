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
import { addThreadMessage } from "../../features/chat/services/addThreadMessage";
import { getFirstLine } from "../../features/chat/utils/common";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useEditorDraft } from "../../hooks/common/useEditorDraft";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadMessageProps, ThreadProps } from "../../types/chat";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
import { FileSizeRejectionSnackbar } from "../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadOverlay, FileUploadStatusBadge } from "../ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../ui/feedback/useFileSizeGuard";
import { useUploadCounter } from "../ui/feedback/useUploadCounter";
import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { getEmojiSuggestionItems } from "./EmojiSuggestion";
import { CreateMentionSpec, MentionMenuItems } from "./Mention";
import {
    codeBlockEnterShortcut,
    getBlockTypeSelectItemsWithCodeBlock,
} from "./sub/codeBlockExtras";
import { EditorSendButton } from "./sub/EditorSendButton";

const base_url = import.meta.env.VITE_API_BASE_URL;
const django_url = import.meta.env.VITE_DJANGO_URL;

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
    const urlLinkModal = useUrlLinkModal();
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);
    const bnBoxClassName: string = `bn-chat-editor-box-${mode}`;

    const teamMembersRef = useRef(useTEM.teamMembers);
    const teamMemberProfilesRef = useRef(useTEM.teamMemberProfiles);
    useEffect(() => {
        teamMembersRef.current = useTEM.teamMembers;
        teamMemberProfilesRef.current = useTEM.teamMemberProfiles;
    }, [useTEM.teamMembers, useTEM.teamMemberProfiles]);

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
            const formData = new FormData();
            formData.append("team_id", String(myself.teamId));
            formData.append("chat_type", String(thread.chatType));
            formData.append("chat_id", String(thread.chatId));
            formData.append("message_id", String(thread.messages.length + 1));
            formData.append("thread_id", String(thread.threadId));
            formData.append("uploader", myself.userId);
            formData.append("chat_attachment_file", file);
            const uploadChatAttachmentResponse = await fetch(`${base_url}/chat/attachment/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            });
            const uploadChatAttachmentData = await uploadChatAttachmentResponse.json();

            if (!uploadChatAttachmentResponse.ok) {
                throw new Error(
                    uploadChatAttachmentData.message || t.common.editor.attachmentUploadFailed
                );
            }

            return `${django_url}${uploadChatAttachmentData.chatAttachmentUrl}`;
        })
    );

    // We use the English, default dictionary
    const locale = en;
    const editor = useCreateBlockNote({
        schema,
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
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const insertEmoji = (emoji: any) => {
        editor.insertInlineContent([{ type: "text", text: emoji, styles: {} }]);
        setShowEmojiPicker(false);
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
        if (editor.document.length > 1 && socket !== null) {
            // Set input text
            const content: any[] | any = editor.document;
            let contentText: string = "Something wrong....";
            if (content && content.length > 0) {
                contentText = getFirstLine(content[0]);
            } else if (editor.document.slice(-2, -1)[0].type === "image") {
                contentText = t.common.editor.imageAttachment;
            }

            socket.emit(
                "thread_message",
                {
                    methodType: "POST",
                    isInit: false,
                    rootMessageTSSent: "",
                    rootMessageSenderId: null,
                    rootMessageReceiverId: null,
                    threadId: thread.threadId,
                    threadMessage: editor.document,
                    chatType: thread.chatType,
                    dmPartnerUserId: thread.dmPartnerUser.userId,
                    senderId: myself.userId,
                    senderName: myself.userName,
                    destCGName: thread.chatName,
                    destCGId: thread.chatId,
                    taskId: thread.taskId,
                    systemUserId: thread.systemUserId || null,
                    messageIdForPut: null,
                },
                (ack: any) => {
                    const updatedChat: ThreadProps = {
                        chatId: thread.chatId,
                        chatName: thread.chatName,
                        threadId: thread.threadId,
                        chatType: thread.chatType,
                        dmPartnerUser: thread.dmPartnerUser,
                        taskId: thread.taskId,
                        messages: [
                            ...thread.messages,
                            {
                                chatType: thread.chatType,
                                messageIdWithChatIdAndThreadId: `${thread.chatId}-${
                                    thread.threadId
                                }-${String(Number(thread.messages.length) + 1)}`,
                                chatId: thread.chatId,
                                threadId: thread.threadId,
                                messageId: Number(thread.messages.length) + 1,
                                content: editor.document,
                                contentText: contentText,
                                sender: myself,
                                tsSent: getLocalCurrentTimestamp(),
                                tsUpdated: getLocalCurrentTimestamp(),
                                taskId: thread.taskId,
                            },
                        ],
                        TSLastMessage: getLocalCurrentTimestamp(),
                        taskExist: thread.taskId !== null ? true : false,
                    };
                    setCurrentThreadChat(updatedChat);

                    const newThreadMessage: ThreadMessageProps = {
                        chatType: thread.chatType,
                        messageIdWithChatIdAndThreadId: `${thread.chatId}-${
                            thread.threadId
                        }-${String(Number(thread.messages.length) + 1)}`,
                        chatId: thread.chatId,
                        threadId: thread.threadId,
                        messageId: Number(thread.messages.length) + 1,
                        content: editor.document,
                        contentText: contentText,
                        sender: myself,
                        tsSent: getLocalCurrentTimestamp(),
                        tsUpdated: getLocalCurrentTimestamp(),
                        taskId: thread.taskId,
                    };

                    addThreadMessage(newThreadMessage, thread.chatType);

                    editor.replaceBlocks(editor.document, []);
                    clearDraft();
                }
            );
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
            <Box
                ref={editorBoxRef}
                className={bnBoxClassName}
                sx={{ position: "relative" }}
            >
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
                            <CreateLinkButton key={"createLinkButton"} />
                            <FileCaptionButton key={"fileCaptionButton"} />
                            <FileReplaceButton key={"replaceFileButton"} />
                            <FileDeleteButton key={"fileDeleteButton"} />
                            <FileDownloadButton key={"fileDownloadButton"} />
                            <FilePreviewButton key={"filePreviewButton"} />
                            <FileRenameButton key={"fileRenameButton"} />

                            {/* Extra button to toggle blue text & background */}
                            <CustomEmojiToolbar
                                key={"customButton"}
                                setShowEmojiPicker={setShowEmojiPicker}
                            />
                        </FormattingToolbar>
                    </Box>

                    {/* Adds a mentions menu which opens with the "@" key */}
                    <SuggestionMenuController
                        triggerCharacter={"@"}
                        getItems={async (query) =>
                            filterSuggestionItems(
                                MentionMenuItems(
                                    teamMemberProfilesRef.current,
                                    editor,
                                    teamMembersRef.current
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
