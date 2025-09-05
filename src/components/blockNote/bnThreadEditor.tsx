import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { Box, IconButton, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import SendIcon from "@mui/icons-material/Send";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { en } from "@blocknote/core/locales";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { codeBlock } from "@blocknote/code-block";
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
} from "@blocknote/react";
import {
    BlockNoteSchema,
    defaultInlineContentSpecs,
    filterSuggestionItems,
    defaultBlockSpecs,
} from "@blocknote/core";

import { countBnLines } from "./services/countBnLines";
import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { CreateMentionSpec, MentionMenuItems } from "./Mention";
import { EmojiPicker } from "../emojiInput/EmojiPicker";
import { getCurrentTimestamp } from "../../utils/dateUtils";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import { ThreadMessageProps, ThreadProps } from "../../types/chat";
import { addThreadMessage } from "../../features/chat/services/addThreadMessage";

type BnThreadEditorProps = {
    teamMemberStatus: Record<string, boolean>;
    myself: UserProps;
    socket: Socket | null;
    teamMembers: UserProps[];
    thread: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
    numEditorLines: number;
    setNumEditorLines: (value: number) => void;
};
export const BnThreadEditor = (props: BnThreadEditorProps) => {
    const {
        teamMemberStatus,
        myself,
        socket,
        teamMembers,
        thread,
        setCurrentThreadChat,
        setCurrentChat,
        setOpeningService,
        numEditorLines,
        setNumEditorLines,
    } = props;
    const { mode } = useColorScheme();
    const bnBoxClassName: string = `bn-chat-editor-box-${mode}`;

    // Disable the Audio and Image blocks from the built-in schema
    // This is done by picking out the blocks you want to disable
    const { audio, image, video, file, ...remainingBlockSpecs } = defaultBlockSpecs;

    // Our schema with inline content specs, which contain the configs and
    // implementations for inline content  that we want our editor to use.
    const schema = BlockNoteSchema.create({
        inlineContentSpecs: {
            // Adds all default inline content.
            ...defaultInlineContentSpecs,
            // Adds the mention tag.
            mention: CreateMentionSpec(socket, myself, setOpeningService, setCurrentChat),
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

    // We use the English, default dictionary
    const locale = en;

    const editor = useCreateBlockNote({
        schema,
        codeBlock,
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
                Math.max(numEditorLines - 4, 0) * 30 + 200,
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
            const content: any[] | any = editor.document.slice(-2, -1)[0].content;
            var contentText: string = "Something wrong....";
            if (content.length > 0) {
                contentText = content.map((item: any) => item.text).join(" ");
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
                    dmPartnerUserId:
                        thread.dmPartnerUser === null ? null : thread.dmPartnerUser.userId,
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
                        unread: false,
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
                                tsSent: getCurrentTimestamp(),
                                tsUpdated: getCurrentTimestamp(),
                                taskId: thread.taskId,
                            },
                        ],
                        TSLastMessage: getCurrentTimestamp(),
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
                        tsSent: getCurrentTimestamp(),
                        tsUpdated: getCurrentTimestamp(),
                        taskId: thread.taskId,
                    };

                    addThreadMessage(newThreadMessage, thread.chatType);

                    editor.replaceBlocks(editor.document, []);
                }
            );
        }
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
                    className="bn-chat-editor"
                    editor={editor}
                    sideMenu={false} // false for Chat/comment, true for Task content
                    theme={mode === "dark" ? "dark" : "light"}
                    formattingToolbar={false}
                    data-changing-font-demo // custom font
                    onChange={() => {
                        const comments: any[] = editor.document;
                        setNumEditorLines(Math.max(countBnLines(comments), 1));
                        setEditorDocLength(editor.document.length);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            sendingThreadMessage();
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
                        onClick={sendingThreadMessage}
                    >
                        <SendIcon />
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

                            <FileCaptionButton key={"fileCaptionButton"} />
                            <FileReplaceButton key={"replaceFileButton"} />

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
                            {/* Extra button to toggle code styles */}
                            <BasicTextStyleButton
                                key={"codeStyleButton"}
                                basicTextStyle={"code"}
                            />

                            <ColorStyleButton key={"colorStyleButton"} />
                            <CreateLinkButton key={"createLinkButton"} />

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
                                MentionMenuItems(teamMemberStatus, editor, teamMembers),
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
