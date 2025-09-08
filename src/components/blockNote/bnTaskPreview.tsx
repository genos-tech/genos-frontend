import { Socket } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import { codeBlock } from "@blocknote/code-block";
import "@blocknote/core/fonts/inter.css";
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
    FormattingToolbarController,
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
    PartialBlock,
} from "@blocknote/core";

import { CreateMentionSpec, MentionMenuItems } from "./Mention";
import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import "../../App.css";

type BnTaskPreviewProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    teamMembers: UserProps[];
    body: any[];
    setBody: (text: PartialBlock[] | any[]) => void;
    setTaskBodyUpdated?: (value: boolean) => void;
    setTaskBodySaved?: (value: boolean) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
};
export const BnTaskPreview = (props: BnTaskPreviewProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
        socket,
        teamMembers,
        body,
        setBody,
        setTaskBodyUpdated,
        setTaskBodySaved,
        setCurrentChat,
        setOpeningService,
    } = props;

    const { mode } = useColorScheme();
    const bnBoxClassName: string = `bn-task-body-box-${mode}`;

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

    // We use the English, default dictionary
    const locale = en;

    const editor =
        body.length > 0
            ? useCreateBlockNote({
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
                  initialContent: body,
              })
            : useCreateBlockNote({
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

    const countLines = (nodes: any[]): number => {
        let count = 0;
        for (const node of nodes) {
            count += 1; // count the current node itself
            if (node.children?.length) {
                count += countLines(node.children); // recursive call
            }
            if (node.content[0]) {
                count += node.content[0].text.split("\n").length;
            }
        }
        return count;
    };

    const [numEditorLines, setNumEditorLines] = useState<number>(0);

    const editorRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (editorRef.current) {
            const dynamicHeight: number = Math.min(
                Math.max(numEditorLines - 5, 0) * 30 + 300,
                1000
            );
            editorRef.current.style.setProperty("--task-body-editor-height", `${dynamicHeight}px`);
        }
    }, [numEditorLines]);

    // initial height setup
    useEffect(() => {
        const comments: any[] = editor.document;
        setNumEditorLines(countLines(comments));
    }, []);

    useEffect(() => {
        if (selectedEmoji !== null) {
            insertEmoji(selectedEmoji);
        }
    }, [selectedEmoji]);

    return (
        <Box>
            <Box sx={{ position: "relative" }} className={bnBoxClassName} ref={editorRef}>
                <BlockNoteView
                    className="bn-box"
                    editor={editor}
                    sideMenu={true} // false for Chat/comment, true for Task content
                    theme={mode === "dark" ? "dark" : "light"}
                    formattingToolbar={false}
                    data-changing-font-demo // custom font
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            if (editor.document.length > 1) {
                            }
                        }
                    }}
                    onChange={() => {
                        const comments: any[] = editor.document;
                        setNumEditorLines(countLines(comments));
                        setBody(editor.document);
                        if (setTaskBodyUpdated) {
                            setTaskBodyUpdated(true);
                            if (setTaskBodySaved) {
                                setTaskBodySaved(false);
                            }
                        }
                    }}
                >
                    <FormattingToolbarController
                        formattingToolbar={() => (
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
                                <CreateLinkButton key={"createLinkButton"} />

                                {/* Extra button to toggle blue text & background */}
                                <CustomEmojiToolbar
                                    key={"customButton"}
                                    setShowEmojiPicker={setShowEmojiPicker}
                                />
                            </FormattingToolbar>
                        )}
                    />

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
