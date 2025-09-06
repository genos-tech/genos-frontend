import { Socket } from "socket.io-client";
import { useState, useEffect } from "react";
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
    AddCommentButton,
    AddTiptapCommentButton,
    FileDeleteButton,
    FileDownloadButton,
    FilePreviewButton,
    FileRenameButton,
    TableCellMergeButton,
    blockTypeSelectItems,
    BlockTypeSelectItem,
    GridSuggestionMenuController,
    SideMenu,
    SideMenuController,
    BlockColorsItem,
    DragHandleMenu,
    DragHandleMenuProps,
    RemoveBlockItem,
} from "@blocknote/react";
import {
    BlockNoteSchema,
    defaultInlineContentSpecs,
    filterSuggestionItems,
    defaultBlockSpecs,
    PartialBlock,
} from "@blocknote/core";
import { RiAlertFill } from "react-icons/ri";

import { Alert } from "./sub/Alert";
import { ResetBlockTypeItem } from "./sub/ResetBlockTypeItem";
import { CreateMentionSpec, MentionMenuItems } from "./Mention";
import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import "../../App.css";

type BnNoteEditorProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    teamMembers: UserProps[];
    body: any[];
    setBody: (text: PartialBlock[] | any[]) => void;
    setNoteBodyUpdated?: (value: boolean) => void;
    setNoteBodySaved?: (value: boolean) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
};
export const BnNoteEditor = (props: BnNoteEditorProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
        socket,
        teamMembers,
        body,
        setBody,
        setNoteBodyUpdated,
        setNoteBodySaved,
        setCurrentChat,
        setOpeningService,
    } = props;

    const { mode } = useColorScheme();
    const bnBoxClassName: string = `bn-note-body-box-${mode}`;

    // To avoid rendering issues, it's good practice to define your custom drag
    // handle menu in a separate component, instead of inline within the `sideMenu`
    // prop of `SideMenuController`.
    const CustomDragHandleMenu = (props: DragHandleMenuProps) => (
        <DragHandleMenu {...props}>
            <RemoveBlockItem {...props}>Delete</RemoveBlockItem>
            <BlockColorsItem {...props}>Colors</BlockColorsItem>
            {/* Item which resets the hovered block's type. */}
            <ResetBlockTypeItem {...props}>Reset Type</ResetBlockTypeItem>
        </DragHandleMenu>
    );

    // Disable the Audio and Image blocks from the built-in schema
    // This is done by picking out the blocks you want to disable
    const { audio, video, ...remainingBlockSpecs } = defaultBlockSpecs;

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
            ...remainingBlockSpecs,
            alert: Alert,
        },
    });

    // List containing all default Slash Menu Items, as well as our custom one.
    const getCustomSlashMenuItems = (
        editor: typeof schema.BlockNoteEditor
    ): DefaultReactSuggestionItem[] => getDefaultReactSlashMenuItems(editor);

    // Uploads a file to tmpfiles.org and returns the URL to the uploaded file.
    async function uploadFile(file: File) {
        // const body = new FormData();
        // body.append("file", file);
        // console.log(`file:http://localhost:3000/${file.name}`);
        // const ret = await fetch("https://tmpfiles.org/api/v1/upload", {
        //     method: "POST",
        //     body: body,
        // });
        // return (await ret.json()).data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
        return `http://localhost:8890/media/${file.name}`;
    }

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
                  uploadFile,
              })
            : useCreateBlockNote({
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

    const countLines = (nodes: any[]): number => {
        let count = 0;
        for (const node of nodes) {
            count += 1; // count the current node itself
            if (node.children?.length) {
                count += countLines(node.children); // recursive call
            }
        }
        return count;
    };

    useEffect(() => {
        if (selectedEmoji !== null) {
            insertEmoji(selectedEmoji);
        }
    }, [selectedEmoji]);

    return (
        <Box>
            <Box sx={{ position: "relative" }} className={bnBoxClassName}>
                <BlockNoteView
                    className="bn-note-editor"
                    editor={editor}
                    sideMenu={false}
                    emojiPicker={false}
                    theme={mode === "dark" ? "dark" : "light"}
                    formattingToolbar={false}
                    data-changing-font-demo // custom font
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            if (editor.document.length > 1) {
                                //Auto saving logic here
                            }
                        }
                    }}
                    onChange={() => {
                        setBody(editor.document);
                        if (setNoteBodyUpdated) {
                            setNoteBodyUpdated(true);
                            if (setNoteBodySaved) {
                                setNoteBodySaved(false);
                            }
                        }
                    }}
                >
                    <GridSuggestionMenuController
                        triggerCharacter={":"}
                        // Changes the Emoji Picker to only have 5 columns.
                        columns={5}
                        minQueryLength={2}
                    />

                    <SideMenuController
                        sideMenu={(props) => (
                            <SideMenu {...props} dragHandleMenu={CustomDragHandleMenu} />
                        )}
                    />
                    <FormattingToolbarController
                        formattingToolbar={() => (
                            <FormattingToolbar>
                                <BlockTypeSelect
                                    key={"blockTypeSelect"}
                                    items={[
                                        // Gets the default Block Type Select items.
                                        ...blockTypeSelectItems(editor.dictionary),
                                        // Adds an item for the Alert block.
                                        {
                                            name: "Alert",
                                            type: "alert",
                                            icon: RiAlertFill,
                                            isSelected: (block) => block.type === "alert",
                                        } satisfies BlockTypeSelectItem,
                                    ]}
                                />

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
                                <FileCaptionButton key={"fileCaptionButton"} />
                                <FileReplaceButton key={"fileReplaceButton"} />
                                <AddCommentButton key={"addCommentButton"} />
                                <AddTiptapCommentButton key={"addTiptapCommentButton"} />
                                <FileDeleteButton key={"fileDeleteButton"} />
                                <FileDownloadButton key={"fileDownloadButton"} />
                                <FilePreviewButton key={"filePreviewButton"} />
                                <FileRenameButton key={"fileRenameButton"} />
                                <TableCellMergeButton key={"tableCellMergeButton"} />
                                {/* <CustomEmojiToolbar
                                    key={"customButton"}
                                    setShowEmojiPicker={setShowEmojiPicker}
                                /> */}
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
