import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { Box, IconButton, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import SendIcon from "@mui/icons-material/Send";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { codeBlock } from "@blocknote/code-block";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import {
    BasicTextStyleButton,
    BlockTypeSelect,
    ColorStyleButton,
    CreateLinkButton,
    FileCaptionButton,
    FileReplaceButton,
    FormattingToolbar,
    useCreateBlockNote,
    DefaultReactSuggestionItem,
    SuggestionMenuController,
    getDefaultReactSlashMenuItems,
    FileRenameButton,
    FilePreviewButton,
    FileDownloadButton,
    FileDeleteButton,
} from "@blocknote/react";
import {
    BlockNoteSchema,
    defaultInlineContentSpecs,
    filterSuggestionItems,
    defaultBlockSpecs,
} from "@blocknote/core";

import { CreateMentionSpec, MentionMenuItems } from "./Mention";
import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { EmojiPicker } from "../emojiInput/EmojiPicker";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { UserProps } from "../../types/admin";
import { ChatProps, AllChatProps, MessageProps } from "../../types/chat";
import { addChat } from "../../features/chat/services/addChat";
import { addMessage } from "../../features/chat/services/addMessage";
import { useAuth } from "../../context/AuthContext";
import { getFirstLine } from "../../features/chat/utils/common";

const base_url = import.meta.env.VITE_API_BASE_URL;
const django_url = import.meta.env.VITE_DJANGO_URL;

type BnChatEditorProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    teamMembers: UserProps[];
    chat: ChatProps;
    setCurrentChat: (chat: ChatProps) => void;
    isSubChatVisible: boolean;
    funcSetAllChats: () => Promise<void>;
    setOpeningService: (value: number) => void;
    numEditorLines: number;
    setNumEditorLines: (value: number) => void;
};
export const BnChatEditor = (props: BnChatEditorProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
        socket,
        teamMembers,
        chat,
        setCurrentChat,
        isSubChatVisible,
        funcSetAllChats,
        setOpeningService,
        numEditorLines,
        setNumEditorLines,
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
            mention: CreateMentionSpec(
                teamMemberProfiles,
                socket,
                myself,
                setMyself,
                setOpeningService,
                setCurrentChat
            ),
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
        formData.append("chat_type", String(chat.chatType));
        formData.append("chat_id", String(chat.chatId));
        formData.append("message_id", String(chat.messages.length + 1));
        formData.append("thread_id", "0");
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
                isSubChatVisible === true ? 290 : 500
            );
            editorRef.current.style.setProperty("--chat-editor-height", `${dynamicHeight}px`);
        }
    }, [numEditorLines]);

    useEffect(() => {
        editor.replaceBlocks(editor.document, []);
    }, [chat]);

    const sendingMessage = async () => {
        if (editor.document.length > 1 && socket !== null) {
            // Set input text
            const content: any[] | any = editor.document.slice(-2, -1)[0].content;
            var contentText: string = "Something wrong....";
            if (content && content.length > 0) {
                contentText = getFirstLine(content[0]);
            } else if (editor.document.slice(-2, -1)[0].type === "image") {
                contentText = "Image attachment";
            }

            socket.emit(
                "message",
                {
                    methodType: "POST",
                    message: editor.document,
                    destCGName: chat.chatName,
                    destCGId: chat.chatId,
                    chatType: chat.chatType,
                    dmPartnerUserId: chat.dmPartnerUser.userId,
                    taskId: null,
                    taskStatus: null,
                    systemUserId: null,
                    messageIdForPut: null,
                },
                async (ack: any) => {
                    const updatedChat: ChatProps = {
                        chatId: chat.chatId,
                        chatName: chat.chatName,
                        chatType: chat.chatType,
                        systemUserId: chat.systemUserId,
                        dmPartnerUser: chat.dmPartnerUser,
                        lastReadMessageId: chat.lastReadMessageId + 1,
                        messages: [
                            ...chat.messages,
                            {
                                chatType: chat.chatType,
                                messageIdWithChatId: `${chat.chatId}-${String(
                                    Number(chat.latestMessage?.messageId) + 1
                                )}`,
                                chatId: chat.chatId,
                                messageId: Number(chat.latestMessage?.messageId) + 1,
                                content: editor.document,
                                contentText: contentText,
                                sender: myself,
                                tsSent: getLocalCurrentTimestamp(),
                                tsUpdated: getLocalCurrentTimestamp(),
                                numReplies: 0,
                                taskId: null,
                                taskStatus: null,
                            },
                        ],
                        latestMessage: {
                            chatType: chat.chatType,
                            systemUserId: chat.systemUserId,
                            messageIdWithChatId: `${chat.chatId}-${String(
                                Number(chat.latestMessage?.messageId) + 1
                            )}`,
                            chatId: chat.chatId,
                            messageId: Number(chat.latestMessage?.messageId) + 1,
                            content: editor.document,
                            contentText: contentText,
                            sender: myself,
                            tsSent: getLocalCurrentTimestamp(),
                            tsUpdated: getLocalCurrentTimestamp(),
                            numReplies: 0,
                            taskId: null,
                            taskStatus: null,
                        },
                        latestMessageText: contentText,
                        TSLastMessage: getLocalCurrentTimestamp(),
                        profileImagePath: chat.profileImagePath,
                    };
                    setCurrentChat(updatedChat);

                    const latestMessage: MessageProps = {
                        chatType: chat.chatType,
                        systemUserId: chat.systemUserId,
                        messageIdWithChatId: `${chat.chatId}-${String(
                            Number(chat.latestMessage?.messageId) + 1
                        )}`,
                        chatId: chat.chatId,
                        messageId: Number(chat.latestMessage?.messageId) + 1,
                        content: editor.document,
                        contentText: contentText,
                        sender: myself,
                        tsSent: getLocalCurrentTimestamp(),
                        tsUpdated: getLocalCurrentTimestamp(),
                        numReplies: 0,
                        taskId: null,
                        taskStatus: null,
                    };
                    if (latestMessage) {
                        const newChat: AllChatProps = {
                            chatId: chat.chatId,
                            chatName: chat.chatName,
                            systemUserId: chat.systemUserId,
                            chatType: chat.chatType,
                            dmPartnerUser: chat.dmPartnerUser,
                            lastReadMessageId:
                                chat.messages[chat.messages.length - 1].messageId + 1,
                            latestMessage: latestMessage,
                            latestMessageText: contentText,
                            TSLastMessage: getLocalCurrentTimestamp(),
                            profileImagePath: chat.profileImagePath,
                        };

                        if (newChat) {
                            await addMessage(latestMessage, newChat.chatType);
                            await addChat(newChat, newChat.chatType);
                            funcSetAllChats();

                            editor.replaceBlocks(editor.document, []);
                        }
                    }
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
                showEmojiPicker={showEmojiPicker}
                setShowEmojiPicker={setShowEmojiPicker}
                setSelectedEmoji={setSelectedEmoji}
            />
            <Box sx={{ position: "relative" }} className={bnBoxClassName} ref={editorRef}>
                <BlockNoteView
                    className="bn-box"
                    editor={editor}
                    sideMenu={false} // false for Chat/comment, true for Task content
                    theme={mode === "dark" ? "dark" : "light"}
                    formattingToolbar={false}
                    data-changing-font-demo // custom font
                    onChange={() => {
                        const comments: any[] = editor.document;
                        setNumEditorLines(countLines(comments));
                        setEditorDocLength(editor.document.length);
                    }}
                    onKeyDown={async (event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            sendingMessage();
                        }
                    }}
                >
                    <Tooltip title="Edit in Modal (TBD)">
                        <IconButton
                            size="sm"
                            color="neutral"
                            variant="plain"
                            sx={{
                                position: "absolute",
                                top: "5%",
                                right: "1%",
                                zIndex: 1,
                                p: 0.7,
                            }}
                        >
                            <OpenInNewIcon />
                        </IconButton>
                    </Tooltip>

                    <IconButton
                        size="sm"
                        color="success"
                        variant="solid"
                        sx={{
                            position: "absolute",
                            bottom: "5%",
                            right: "1%",
                            zIndex: 1,
                            p: 0.7,
                        }}
                        disabled={editorDocLength < 2}
                        onClick={async () => sendingMessage()}
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
                                basicTextStyle={"bold"}
                                key={"boldStyleButton"}
                            />
                            <BasicTextStyleButton
                                basicTextStyle={"italic"}
                                key={"italicStyleButton"}
                            />
                            <BasicTextStyleButton
                                basicTextStyle={"underline"}
                                key={"underlineStyleButton"}
                            />
                            <BasicTextStyleButton
                                basicTextStyle={"strike"}
                                key={"strikeStyleButton"}
                            />
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
                                MentionMenuItems(teamMemberProfiles, editor, teamMembers),
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
