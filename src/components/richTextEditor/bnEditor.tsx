import React, { useRef, useState, useEffect } from 'react';
import { Box, IconButton } from "@mui/joy";
import CssBaseline from '@mui/joy/CssBaseline';
import { CssVarsProvider } from '@mui/joy/styles';
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
    NestBlockButton,
    TextAlignButton,
    UnnestBlockButton,
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
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
// This packages some of the most used languages in on-demand bundle
import { codeBlock } from "@blocknote/code-block";
import { CustomEmojiToolbar } from './customEmojiToolbar';
import { Mention } from "./Mention";
import EmojiPicker from '../emojiInput/EmojiPicker'
import { useColorScheme } from '@mui/joy/styles';
import { colors, styled } from '@mui/material';

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

export function App() {
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
        },
        // initialContent: [
        //     {
        //         type: "paragraph",
        //         content: "Welcome to this demo!",
        //     },
        //     {
        //         type: "paragraph",
        //         content: [
        //             {
        //                 type: "text",
        //                 text: "You can now toggle ",
        //                 styles: {},
        //             },
        //             {
        //                 type: "text",
        //                 text: "blue",
        //                 styles: { textColor: "blue", backgroundColor: "blue" },
        //             },
        //             {
        //                 type: "text",
        //                 text: " and ",
        //                 styles: {},
        //             },
        //             {
        //                 type: "text",
        //                 text: "code",
        //                 styles: { code: true },
        //             },
        //             {
        //                 type: "text",
        //                 text: " styles with new buttons in the Formatting Toolbar",
        //                 styles: {},
        //             },
        //         ],
        //     },
        //     {
        //         type: "paragraph",
        //         content: "Select some text to try them out",
        //     },
        //     {
        //         type: "paragraph",
        //     },
        //     {
        //         type: "paragraph",
        //         content: "Welcome to this demo!",
        //     },
        //     {
        //         type: "paragraph",
        //         content: [
        //             {
        //                 type: "mention",
        //                 props: {
        //                     user: "Steve",
        //                 },
        //             },
        //             {
        //                 type: "text",
        //                 text: " <- This is an example mention",
        //                 styles: {},
        //             },
        //         ],
        //     },
        //     {
        //         type: "paragraph",
        //         content: "Press the '@' key to open the mentions menu and add another",
        //     },
        //     {
        //         type: "paragraph",
        //     },
        // ],
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
                    className="blocknote-editor"
                    editor={editor}
                    sideMenu={false} // false for Chat/comment, true for Task content
                    theme={mode === 'dark' ? 'dark' : 'light'}
                    formattingToolbar={false}
                    data-changing-font-demo // custom font
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                            if (editor.document.length > 1) {
                                console.log(editor.document);
                                console.log("Send")
                            }
                        }
                    }}
                >
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
                                console.log(editor.document);
                                console.log("Send")
                            }
                        }}
                    >
                        <SendIcon />
                        Send
                    </IconButton>

                    <Box
                        sx={{}}
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

                            <NestBlockButton key={"nestBlockButton"} />
                            <UnnestBlockButton key={"unnestBlockButton"} />

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

export default App;


