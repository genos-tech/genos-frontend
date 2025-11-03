import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useEffect, useRef, useState } from "react";
import { codeBlock } from "@blocknote/code-block";
import {
    BlockNoteSchema,
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
import SendIcon from "@mui/icons-material/Send";
import { Box, IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useAuth } from "../../context/AuthContext";
import { addThreadMessage } from "../../features/chat/services/addThreadMessage";
import { getFirstLine } from "../../features/chat/utils/common";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadMessageProps, ThreadProps } from "../../types/chat";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { EmojiPicker } from "../emojiInput/EmojiPicker";
import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { CreateMentionSpec, MentionMenuItems } from "./Mention";

const base_url = import.meta.env.VITE_API_BASE_URL;
const django_url = import.meta.env.VITE_DJANGO_URL;

type BnThreadEditorProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    TEM: TeamManagementState;
    thread: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setCurrentChat: (chat: ChatProps) => void;
    UIM: UIStateManagementState;
    numEditorLines: number;
    setNumEditorLines: (value: number) => void;
    CM: ChatManagementState;
};
export const BnThreadEditor = (props: BnThreadEditorProps) => {
    const {
        TEM,
        myself,
        setMyself,
        socket,
        thread,
        setCurrentThreadChat,
        setCurrentChat,
        UIM,
        numEditorLines,
        setNumEditorLines,
        CM,
    } = props;
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
    const bnBoxClassName: string = `bn-chat-editor-box-${mode}`;

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
            mention: CreateMentionSpec(TEM.teamMemberProfiles, socket, myself, setMyself, UIM, CM),
        },
        blockSpecs: {
            // remainingBlockSpecs contains all the other blocks
            ...remainingBlockSpecs,
        },
    });

    // List containing all default Slash Menu Items, as well as our custom one.
    const getCustomSlashMenuItems = (
        editor: typeof schema.BlockNoteEditor
    ): DefaultReactSuggestionItem[] => getDefaultReactSlashMenuItems(editor);

    // Uploads a file to tmpfiles.org and returns the URL to the uploaded file.
    async function uploadFile(file: File) {
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
            throw new Error(uploadChatAttachmentData.message || "Attachment Upload Failed");
        }

        return `${django_url}/${uploadChatAttachmentData.chatAttachmentUrl}`;
    }

    // We use the English, default dictionary
    const locale = en;
    const editor = useCreateBlockNote({
        schema,
        codeBlock,
        uploadFile,
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

    const [editorDocLength, setEditorDocLength] = useState<number>(0);

    const editorRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (editorRef.current) {
            const dynamicHeight: number = Math.min(
                Math.min(Math.max(numEditorLines - 8, 0), 10) * 20 + 200,
                500
            );
            editorRef.current.style.setProperty("--chat-editor-height", `${dynamicHeight}px`);
        }
    }, [numEditorLines]);

    useEffect(() => {
        editor.replaceBlocks(editor.document, []);
    }, [thread]);

    const sendingThreadMessage = async () => {
        if (editor.document.length > 1 && socket !== null) {
            // Set input text
            const content: any[] | any = editor.document;
            let contentText: string = "Something wrong....";
            if (content && content.length > 0) {
                contentText = getFirstLine(content[0]);
            } else if (editor.document.slice(-2, -1)[0].type === "image") {
                contentText = "Image attachment";
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
            <EmojiPicker
                setSelectedEmoji={setSelectedEmoji}
                setShowEmojiPicker={setShowEmojiPicker}
                showEmojiPicker={showEmojiPicker}
            />
            <Box ref={editorRef} className={bnBoxClassName} sx={{ position: "relative" }}>
                <BlockNoteView
                    className="bn-box"
                    editor={editor}
                    formattingToolbar={false}
                    sideMenu={false} // false for Chat/comment, true for Task content
                    theme={mode === "dark" ? "dark" : "light"}
                    data-changing-font-demo // custom font
                    onChange={() => {
                        const comments: any[] = editor.document;
                        setNumEditorLines(countLines(comments));
                        setEditorDocLength(editor.document.length);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            sendingThreadMessage();
                        }
                    }}
                >
                    <IconButton
                        color="success"
                        disabled={editorDocLength < 2}
                        size="sm"
                        variant="solid"
                        sx={{
                            position: "absolute",
                            bottom: "5%",
                            right: "1%",
                            zIndex: 1,
                            p: 0.7,
                        }}
                        onClick={sendingThreadMessage}
                    >
                        <SendIcon sx={{ mr: "3px" }} />
                        Send
                    </IconButton>

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
                            <BlockTypeSelect key={"blockTypeSelect"} />

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
                            // Gets the mentions menu items
                            filterSuggestionItems(
                                MentionMenuItems(TEM.teamMemberProfiles, editor, TEM.teamMembers),
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
                </BlockNoteView>
            </Box>
        </Box>
    );
};
