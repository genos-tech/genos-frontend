import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useEffect, useRef, useState } from "react";
import { codeBlockOptions } from "@blocknote/code-block";
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
import { addChat } from "../../features/chat/services/addChat";
import { addMessage } from "../../features/chat/services/addMessage";
import { getFirstLine } from "../../features/chat/utils/common";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps, MessageProps } from "../../types/chat";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { CreateMentionSpec, MentionMenuItems } from "./Mention";

const base_url = import.meta.env.VITE_API_BASE_URL;
const django_url = import.meta.env.VITE_DJANGO_URL;

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
        numEditorLines,
        setNumEditorLines,
        pendingFiles,
        clearPendingFiles,
    } = props;
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
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
        codeBlock: codeBlockOptions,
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

    // Process files dropped on the chat pane (outside the editor)
    useEffect(() => {
        if (pendingFiles && pendingFiles.length > 0 && clearPendingFiles) {
            const insertFiles = async () => {
                for (const file of pendingFiles) {
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
                clearPendingFiles();
            };
            insertFiles();
        }
    }, [pendingFiles]);

    const [editorDocLength, setEditorDocLength] = useState<number>(0);

    const editorRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (editorRef.current) {
            const dynamicHeight: number = Math.min(
                Math.min(Math.max(numEditorLines - 8, 0), 10) * 20 + 200,
                useCM.isSubChatVisible === true ? 290 : 500
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
            const content: any[] | any = editor.document;
            let contentText: string = "Something wrong....";
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
                        const existingAllChat = useCM.allChats.find(
                            (c) => c.chatId === chat.chatId && c.chatType === chat.chatType
                        );
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
                            mdmMembers: existingAllChat?.mdmMembers,
                        };

                        if (newChat) {
                            await addMessage(latestMessage, newChat.chatType);
                            await addChat(newChat, newChat.chatType);
                            await useCM.funcSetAllChats();

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
                    onKeyDown={async (event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            sendingMessage();
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
                </BlockNoteView>
            </Box>
        </Box>
    );
};
