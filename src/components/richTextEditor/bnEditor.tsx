import { useState, useEffect } from 'react';
import { Socket } from "socket.io-client";
import { Box, IconButton } from "@mui/joy";
import { en } from "@blocknote/core/locales";
import SendIcon from '@mui/icons-material/Send';
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
    BasicTextStyleButton,
    BlockTypeSelect,
    ColorStyleButton,
    CreateLinkButton,
    FileCaptionButton,
    FileReplaceButton,
    FormattingToolbar,
    TextAlignButton,
    useCreateBlockNote,
    DefaultReactSuggestionItem,
    SuggestionMenuController,
    getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import {
    BlockNoteSchema,
    defaultInlineContentSpecs,
    filterSuggestionItems,
    defaultBlockSpecs
} from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
// This packages some of the most used languages in on-demand bundle
import { codeBlock } from "@blocknote/code-block";
import { CustomEmojiToolbar } from './customEmojiToolbar';
import { Mention } from "./Mention";
import EmojiPicker from '../emojiInput/EmojiPicker'
import { useColorScheme } from '@mui/joy/styles';
import { UserProps, ChatProps, AllChatProps } from '../../types'
import InsertDMChatWorker from "../../workers/insertDMChatWorker.ts?worker";
import InsertDMMessageWorker from "../../workers/insertDMMessageWorker.ts?worker";
import InsertGMChatWorker from "../../workers/insertGMChatWorker.ts?worker";
import InsertGMMessageWorker from "../../workers/insertGMMessageWorker.ts?worker";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Tooltip from '@mui/joy/Tooltip';

function getCurrentTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}


const insertDMChatAndMessage = async (newDMChat: AllChatProps): Promise<string> => {
    return new Promise((resolve, reject) => {
        const insertDMMessageWorker = new InsertDMMessageWorker();
        insertDMMessageWorker.postMessage({ dmMessage: newDMChat.latestMessage });
        insertDMMessageWorker.onmessage = (event) => {
            resolve(event.data);
            insertDMMessageWorker.terminate();
        };
        insertDMMessageWorker.onerror = (error) => {
            reject(error);
            insertDMMessageWorker.terminate();
        };

        const insertDMChatWorker = new InsertDMChatWorker();
        insertDMChatWorker.postMessage({ dmChat: newDMChat });
        insertDMChatWorker.onmessage = (event) => {
            resolve(event.data);
            insertDMChatWorker.terminate();
        };
        insertDMChatWorker.onerror = (error) => {
            reject(error);
            insertDMChatWorker.terminate();
        };
    });
};

const insertGMChatAndMessage = async (newGMChat: AllChatProps): Promise<string> => {
    return new Promise((resolve, reject) => {
        const insertGMMessageWorker = new InsertGMMessageWorker();
        insertGMMessageWorker.postMessage({ gmMessage: newGMChat.latestMessage });
        insertGMMessageWorker.onmessage = (event) => {
            resolve(event.data);
            insertGMMessageWorker.terminate();
        };
        insertGMMessageWorker.onerror = (error) => {
            reject(error);
            insertGMMessageWorker.terminate();
        };

        const insertGMChatWorker = new InsertGMChatWorker();
        insertGMChatWorker.postMessage({ gmChat: newGMChat });
        insertGMChatWorker.onmessage = (event) => {
            resolve(event.data);
            insertGMChatWorker.terminate();
        };
        insertGMChatWorker.onerror = (error) => {
            reject(error);
            insertGMChatWorker.terminate();
        };
    });
};

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
        mention: Mention,
    },
    blockSpecs: {
        // remainingBlockSpecs contains all the other blocks
        ...remainingBlockSpecs,
    },
});

// Function which gets all users for the mentions menu.
const getMentionMenuItems = (
    editor: typeof schema.BlockNoteEditor
): DefaultReactSuggestionItem[] => {
    const users = ["Steve", "Bob", "Joe", "Mike"];

    return users.map((user) => ({
        title: user,
        onItemClick: () => {
            editor.insertInlineContent([
                {
                    type: "mention",
                    props: {
                        user,
                    },
                },
                " ", // add a space after the mention
            ]);
        },
    }));
};

// List containing all default Slash Menu Items, as well as our custom one.
const getCustomSlashMenuItems = (
    editor: typeof schema.BlockNoteEditor
): DefaultReactSuggestionItem[] => getDefaultReactSlashMenuItems(editor);

type BnEditorProps = {
    myself: UserProps;
    socket: Socket;
    chat: ChatProps;
    setCurrentChat: (chat: ChatProps) => void;
}

export function BnEditor(props: BnEditorProps) {
    const {
        myself,
        socket,
        chat,
        setCurrentChat } = props;
    const { mode } = useColorScheme();
    const bnBoxClassName: string = `bn-box-${mode}`

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
        }
    });

    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const insertEmoji = (emoji: any) => {
        editor.insertInlineContent([
            { type: "text", text: emoji, styles: {} }
        ]);
        setShowEmojiPicker(false);
    };

    useEffect(() => { if (selectedEmoji !== null) { insertEmoji(selectedEmoji) } }, [selectedEmoji])

    return (
        <Box>
            <EmojiPicker
                showEmojiPicker={showEmojiPicker}
                setShowEmojiPicker={setShowEmojiPicker}
                setSelectedEmoji={setSelectedEmoji}
            />
            <Box sx={{ position: 'relative' }} className={bnBoxClassName}>
                <BlockNoteView
                    className="bn-chat-editor"
                    editor={editor}
                    sideMenu={false} // false for Chat/comment, true for Task content
                    theme={mode === 'dark' ? 'dark' : 'light'}
                    formattingToolbar={false}
                    data-changing-font-demo // custom font
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                            if (editor.document.length > 1) {

                                // Set input text
                                const content: any[] | any = editor.document.slice(-2, -1)[0].content;
                                var contentText: string = "Something wrong...."
                                if (content.length > 0) {
                                    contentText = content[0].text
                                }

                                socket.emit("message", {
                                    message: editor.document,
                                    destCGName: chat.chatName,
                                    destCGId: chat.chatId,
                                    isDm: chat.isDm,
                                    dmPartnerUserId: myself.userId,
                                }, (ack: any) => {
                                    const updatedChat: ChatProps = {
                                        chatId: chat.chatId,
                                        chatName: chat.chatName,
                                        isDm: chat.isDm,
                                        dmPartnerUserId: chat.dmPartnerUserId,
                                        unread: false,
                                        messages: [...chat.messages, {
                                            messageIdWithChatId: `${chat.chatId}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                                            chatId: chat.chatId,
                                            messageId: Number(chat.latestMessage?.messageId) + 1,
                                            content: editor.document,
                                            contentText: contentText,
                                            sender: myself,
                                            tsSent: getCurrentTimestamp(),
                                            numReplies: 0,
                                        }],
                                        latestMessage: {
                                            messageIdWithChatId: `${chat.chatId}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                                            chatId: chat.chatId,
                                            messageId: Number(chat.latestMessage?.messageId) + 1,
                                            content: editor.document,
                                            contentText: contentText,
                                            sender: myself,
                                            tsSent: getCurrentTimestamp(),
                                            numReplies: 0,
                                        },
                                        latestMessageText: contentText,
                                        TSLastMessage: getCurrentTimestamp(),
                                    };
                                    setCurrentChat(updatedChat);

                                    const newChat: AllChatProps = {
                                        chatId: chat.chatId,
                                        chatName: chat.chatName,
                                        isDm: chat.isDm,
                                        dmPartnerUserId: chat.dmPartnerUserId,
                                        unread: false,
                                        latestMessage: {
                                            messageIdWithChatId: `${chat.chatId}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                                            chatId: chat.chatId,
                                            messageId: Number(chat.latestMessage?.messageId) + 1,
                                            content: editor.document,
                                            contentText: contentText,
                                            sender: myself,
                                            tsSent: getCurrentTimestamp(),
                                            numReplies: 0,
                                        },
                                        latestMessageText: contentText,
                                        TSLastMessage: getCurrentTimestamp(),
                                    };

                                    if (chat.isDm) {
                                        insertDMChatAndMessage(newChat);
                                    } else {
                                        insertGMChatAndMessage(newChat);
                                    }
                                    editor.replaceBlocks(editor.document, [])
                                });
                            }
                        }
                    }}
                >
                    <Tooltip title="Edit in Modal (TBD)">
                        <IconButton
                            size="sm"
                            color="neutral"
                            variant="plain"
                            sx={{
                                position: 'absolute',
                                top: '5%',
                                right: '1%',
                                zIndex: 1,
                                p: 0.7,
                            }}>
                            <OpenInNewIcon />
                        </IconButton>
                    </Tooltip>

                    <IconButton
                        size="sm"
                        color="success"
                        variant="solid"
                        sx={{
                            position: 'absolute',
                            bottom: '5%',
                            right: '1%',
                            zIndex: 1,
                            p: 0.7,
                        }}
                        onClick={() => {
                            if (editor.document.length > 1) {

                                // Set input text
                                const content: any[] | any = editor.document.slice(-2, -1)[0].content;
                                var contentText: string = "Something wrong...."
                                if (content.length > 0) {
                                    contentText = content[0].text
                                }

                                socket.emit("message", {
                                    message: editor.document,
                                    destCGName: chat.chatName,
                                    destCGId: chat.chatId,
                                    isDm: chat.isDm,
                                    dmPartnerUserId: chat.dmPartnerUserId,
                                }, (ack: any) => {

                                    const updatedChat: ChatProps = {
                                        chatId: chat.chatId,
                                        chatName: chat.chatName,
                                        isDm: chat.isDm,
                                        dmPartnerUserId: chat.dmPartnerUserId,
                                        unread: false,
                                        messages: [...chat.messages, {
                                            messageIdWithChatId: `${chat.chatId}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                                            chatId: chat.chatId,
                                            messageId: Number(chat.latestMessage?.messageId) + 1,
                                            content: editor.document,
                                            contentText: contentText,
                                            sender: myself,
                                            tsSent: getCurrentTimestamp(),
                                            numReplies: 0,
                                        }],
                                        latestMessage: {
                                            messageIdWithChatId: `${chat.chatId}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                                            chatId: chat.chatId,
                                            messageId: Number(chat.latestMessage?.messageId) + 1,
                                            content: editor.document,
                                            contentText: contentText,
                                            sender: myself,
                                            tsSent: getCurrentTimestamp(),
                                            numReplies: 0,
                                        },
                                        latestMessageText: contentText,
                                        TSLastMessage: getCurrentTimestamp(),
                                    };
                                    setCurrentChat(updatedChat);

                                    const newChat: AllChatProps = {
                                        chatId: chat.chatId,
                                        chatName: chat.chatName,
                                        isDm: chat.isDm,
                                        dmPartnerUserId: chat.dmPartnerUserId,
                                        unread: false,
                                        latestMessage: {
                                            messageIdWithChatId: `${chat.chatId}-${String(Number(chat.latestMessage?.messageId) + 1)}`,
                                            chatId: chat.chatId,
                                            messageId: Number(chat.latestMessage?.messageId) + 1,
                                            content: editor.document,
                                            contentText: contentText,
                                            sender: myself,
                                            tsSent: getCurrentTimestamp(),
                                            numReplies: 0,
                                        },
                                        latestMessageText: contentText,
                                        TSLastMessage: getCurrentTimestamp(),
                                    };
                                    if (chat.isDm) {
                                        insertDMChatAndMessage(newChat);
                                    } else {
                                        insertGMChatAndMessage(newChat);
                                    }
                                    editor.replaceBlocks(editor.document, [])
                                });
                            }
                        }}
                    >
                        <SendIcon />
                        Send
                    </IconButton>

                    <Box
                        className="bn-editor-toolbar"
                        sx={{
                            position: 'absolute',
                            top: '1%',
                            left: '0.5%',
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

                            <TextAlignButton
                                textAlignment={"left"}
                                key={"textAlignLeftButton"}
                            />
                            <TextAlignButton
                                textAlignment={"center"}
                                key={"textAlignCenterButton"}
                            />
                            <TextAlignButton
                                textAlignment={"right"}
                                key={"textAlignRightButton"}
                            />

                            <ColorStyleButton key={"colorStyleButton"} />

                            {/* <NestBlockButton key={"nestBlockButton"} />
                            <UnnestBlockButton key={"unnestBlockButton"} /> */}

                            <CreateLinkButton key={"createLinkButton"} />

                            {/* Extra button to toggle blue text & background */}
                            <CustomEmojiToolbar key={"customButton"} setShowEmojiPicker={setShowEmojiPicker} />

                        </FormattingToolbar>
                    </Box>

                    {/* Adds a mentions menu which opens with the "@" key */}
                    <SuggestionMenuController
                        triggerCharacter={"@"}
                        getItems={async (query) =>
                            // Gets the mentions menu items
                            filterSuggestionItems(getMentionMenuItems(editor), query)
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
}

export default BnEditor;


