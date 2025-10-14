import { useEffect, useState } from "react";
import { codeBlock } from "@blocknote/code-block";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import { Box, IconButton, Modal, ModalDialog, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import {
    BlockNoteSchema,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
    filterSuggestionItems,
    PartialBlock,
} from "@blocknote/core";
import {
    AddCommentButton,
    AddTiptapCommentButton,
    BasicTextStyleButton,
    BlockColorsItem,
    BlockTypeSelect,
    BlockTypeSelectItem,
    blockTypeSelectItems,
    ColorStyleButton,
    CreateLinkButton,
    DefaultReactSuggestionItem,
    DragHandleMenu,
    DragHandleMenuProps,
    FileCaptionButton,
    FileDeleteButton,
    FileDownloadButton,
    FilePreviewButton,
    FileRenameButton,
    FileReplaceButton,
    FormattingToolbar,
    FormattingToolbarController,
    getDefaultReactSlashMenuItems,
    GridSuggestionMenuController,
    RemoveBlockItem,
    SideMenu,
    SideMenuController,
    SuggestionMenuController,
    TableCellMergeButton,
    TextAlignButton,
    useCreateBlockNote,
} from "@blocknote/react";
import DownloadIcon from "@mui/icons-material/Download";
import { RiAlertFill } from "react-icons/ri";

import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import { CreateMentionSpec, MentionMenuItems } from "./Mention";
import { Alert } from "./sub/Alert";
import { ResetBlockTypeItem } from "./sub/ResetBlockTypeItem";

import "../../App.css";

import { useAuth } from "../../context/AuthContext";
import { MyNoteProps } from "../../types/notes";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { downloadFile } from "../../utils/downloadUtils";

const base_url = import.meta.env.VITE_API_BASE_URL;
const django_url = import.meta.env.VITE_DJANGO_URL;

type BnMyNoteEditorProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    teamMembers: UserProps[];
    currentMyNote: MyNoteProps;
    body: any[];
    setBody: (text: PartialBlock[] | any[]) => void;
    setNoteBodyEdited?: (value: boolean) => void;
    setNoteBodySaved?: (value: boolean) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
};
export const BnMyNoteEditor = (props: BnMyNoteEditorProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
        socket,
        teamMembers,
        currentMyNote,
        body,
        setBody,
        setNoteBodyEdited,
        setNoteBodySaved,
        setCurrentChat,
        setOpeningService,
    } = props;

    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
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
        const formData = new FormData();
        formData.append("note_attachment_file", file);
        formData.append("note_id", String(currentMyNote.noteId));
        formData.append("uploader", myself.userId);
        const uploadNoteAttachmentResponse = await fetch(`${base_url}/note/personal/attachment/`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: formData,
        });
        const uploadNoteAttachmentData = await uploadNoteAttachmentResponse.json();

        if (!uploadNoteAttachmentResponse.ok) {
            throw new Error(uploadNoteAttachmentData.message || "Attachment Upload Failed");
        }

        return `${django_url}/${uploadNoteAttachmentData.noteAttachmentUrl}`;
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
            if (node.content[0]) {
                if (node.content[0].text) {
                    count += node.content[0].text.split("\n").length;
                }
            }
        }
        return count;
    };

    useEffect(() => {
        if (selectedEmoji !== null) {
            insertEmoji(selectedEmoji);
        }
    }, [selectedEmoji]);

    // State for modal
    const [opened, setOpened] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Custom click handler
    const handleImageClick = (src: string) => {
        setSelectedImage(src);
        setOpened(true);
    };

    const handleDownload = async (
        url: string,
        filename = `image-${getLocalCurrentTimestamp()}.png`
    ) => {
        await downloadFile(url, filename);
    };

    return (
        <Box sx={{ position: "relative" }} className={bnBoxClassName}>
            <BlockNoteView
                className="bn-box"
                editor={editor}
                sideMenu={false}
                emojiPicker={false}
                theme={mode === "dark" ? "dark" : "light"}
                formattingToolbar={false}
                data-changing-font-demo // custom font
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.tagName === "IMG") {
                        handleImageClick((target as HTMLImageElement).src);
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                        if (editor.document.length > 1) {
                            //Auto saving logic here
                        }
                    }
                }}
                onChange={() => {
                    setBody(editor.document);
                    if (setNoteBodyEdited) {
                        setNoteBodyEdited(true);
                        if (setNoteBodySaved) {
                            setNoteBodySaved(false);
                        }
                    }
                }}
            >
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
                            <TextAlignButton textAlignment={"left"} key={"textAlignLeftButton"} />
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

            <Modal sx={{ zIndex: 10010 }} open={opened} onClose={() => setOpened(false)}>
                <ModalDialog>
                    {selectedImage ? (
                        <Box>
                            <img src={selectedImage} alt="preview" />
                            <Tooltip
                                placement="top"
                                title="Download"
                                sx={{ zIndex: 10010 }}
                                component="div"
                            >
                                <IconButton
                                    onClick={() => handleDownload(selectedImage)}
                                    color="neutral"
                                    variant="solid"
                                    sx={{ position: "absolute", top: "10px", right: "10px" }}
                                >
                                    <DownloadIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    ) : null}
                </ModalDialog>
            </Modal>
        </Box>
    );
};
