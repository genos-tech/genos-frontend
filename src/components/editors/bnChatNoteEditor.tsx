import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "../../App.css";

import { useEffect, useMemo, useState } from "react";
import {
    BlockNoteSchema,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
    filterSuggestionItems,
    PartialBlock,
} from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import {
    AddCommentButton,
    BasicTextStyleButton,
    BlockColorsItem,
    BlockNoteViewEditor,
    BlockTypeSelect,
    BlockTypeSelectItem,
    blockTypeSelectItems,
    ColorStyleButton,
    CreateLinkButton,
    DefaultReactSuggestionItem,
    DragHandleMenu,
    FileCaptionButton,
    FileDeleteButton,
    FileDownloadButton,
    FilePreviewButton,
    FileRenameButton,
    FileReplaceButton,
    FloatingComposerController,
    FloatingThreadController,
    FormattingToolbar,
    FormattingToolbarController,
    getDefaultReactSlashMenuItems,
    RemoveBlockItem,
    SideMenu,
    SideMenuController,
    SuggestionMenuController,
    TableCellMergeButton,
    TextAlignButton,
} from "@blocknote/react";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import DownloadIcon from "@mui/icons-material/Download";
import { Box, IconButton, Modal, ModalDialog, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { RiAlertFill } from "react-icons/ri";
import { Socket } from "socket.io-client";

import { useAuth } from "../../context/AuthContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useCollaborativeBlockNote } from "../../hooks/common/useCollaborativeBlockNote";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { ChatNoteProps } from "../../types/notes";
import { getUserColor } from "../../utils/collabUtils";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { downloadFile } from "../../utils/downloadUtils";
import { CreateMentionSpec, MentionMenuItems } from "./Mention";
import { Alert } from "./sub/Alert";
import { ResetBlockTypeItem } from "./sub/ResetBlockTypeItem";
import { ThreadsSidebarErrorBoundary } from "./sub/ThreadsSidebarErrorBoundary";
import { ThreadsSidebarWithPreload } from "./sub/ThreadsSidebarWithPreload";

const base_url = import.meta.env.VITE_API_BASE_URL;
const django_url = import.meta.env.VITE_DJANGO_URL;

type BnChatNoteEditorProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useCM: ChatManagementState;
    currentChatNote: ChatNoteProps;
    body: any[];
    setBody: (text: PartialBlock[] | any[]) => void;
    setNoteBodyEdited?: (value: boolean) => void;
    setNoteBodySaved?: (value: boolean) => void;
    useUISM: UIStateManagementState;
};
export const BnChatNoteEditor = (props: BnChatNoteEditorProps) => {
    const {
        useTEM,
        socket,
        myself,
        setMyself,
        currentChatNote,
        body,
        setBody,
        setNoteBodyEdited,
        setNoteBodySaved,
        useUISM,
        useCM,
    } = props;

    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
    const bnBoxClassName: string = `bn-note-body-box-${mode}`;

    // To avoid rendering issues, it's good practice to define your custom drag
    // handle menu in a separate component, instead of inline within the `sideMenu`
    // prop of `SideMenuController`.
    const CustomDragHandleMenu = () => (
        <DragHandleMenu>
            <RemoveBlockItem>Delete</RemoveBlockItem>
            <BlockColorsItem>Colors</BlockColorsItem>
            {/* Item which resets the hovered block's type. */}
            <ResetBlockTypeItem>Reset Type</ResetBlockTypeItem>
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
                useTEM.teamMemberProfiles,
                socket,
                myself,
                setMyself,
                useUISM,
                useCM
            ),
        },
        blockSpecs: {
            ...remainingBlockSpecs,
            alert: Alert(),
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
        formData.append("note_id", String(currentChatNote.noteId));
        formData.append("uploader", myself.userId);
        const uploadNoteAttachmentResponse = await fetch(`${base_url}/note/chat/attachment/`, {
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

    const locale = en;
    const dictionary = useMemo(
        () => ({
            ...locale,
            placeholders: {
                ...locale.placeholders,
                emptyDocument: "Start typing...",
                default: "Type something...",
                heading: "Custom heading placeholder",
            },
        }),
        []
    );

    const collabUser = useMemo(
        () => ({ name: myself.userName, color: getUserColor(myself.userId) }),
        [myself.userName, myself.userId]
    );

    const documentName = `chat-note:${currentChatNote.noteId}`;

    const { editor, threadStore } = useCollaborativeBlockNote({
        documentName,
        user: collabUser,
        userId: myself.userId,
        myself,
        accessToken,
        schema,
        dictionary,
        uploadFile,
        initialBody: body,
        enableComments: true,
        teamMemberProfiles: useTEM.teamMemberProfiles,
    });

    const [showThreadsSidebar, setShowThreadsSidebar] = useState(false);
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
        filename = `chat-note-image-${getLocalCurrentTimestamp()}.png`
    ) => {
        await downloadFile(url, filename);
    };

    return (
        <Box className={bnBoxClassName} sx={{ position: "relative" }}>
            <Tooltip
                placement="left"
                size="sm"
                title={showThreadsSidebar ? "Hide Comments" : "Show Comments"}
                variant="outlined"
            >
                <IconButton
                    color="neutral"
                    size="sm"
                    sx={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}
                    variant={showThreadsSidebar ? "solid" : "outlined"}
                    onClick={() => setShowThreadsSidebar((prev) => !prev)}
                >
                    <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Tooltip>

            <BlockNoteView
                className="bn-box"
                editor={editor as any}
                emojiPicker={false}
                formattingToolbar={false}
                sideMenu={false}
                comments={false}
                renderEditor={false}
                theme={mode === "dark" ? "dark" : "light"}
                data-changing-font-demo
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
                <div
                    className="bn-editor-with-sidebar"
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
                >
                    <div className="bn-editor-section">
                        <BlockNoteViewEditor>
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
                                                ...blockTypeSelectItems(editor.dictionary),
                                                {
                                                    name: "Alert",
                                                    type: "alert",
                                                    icon: RiAlertFill,
                                                } satisfies BlockTypeSelectItem,
                                            ]}
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
                                        <BasicTextStyleButton
                                            key={"codeStyleButton"}
                                            basicTextStyle={"code"}
                                        />
                                        <TextAlignButton
                                            key={"textAlignLeftButton"}
                                            textAlignment={"left"}
                                        />
                                        <TextAlignButton
                                            key={"textAlignCenterButton"}
                                            textAlignment={"center"}
                                        />
                                        <TextAlignButton
                                            key={"textAlignRightButton"}
                                            textAlignment={"right"}
                                        />
                                        <ColorStyleButton key={"colorStyleButton"} />
                                        <CreateLinkButton key={"createLinkButton"} />
                                        <FileCaptionButton key={"fileCaptionButton"} />
                                        <FileReplaceButton key={"fileReplaceButton"} />
                                        {threadStore && (
                                            <AddCommentButton key={"addCommentButton"} />
                                        )}
                                        <FileDeleteButton key={"fileDeleteButton"} />
                                        <FileDownloadButton key={"fileDownloadButton"} />
                                        <FilePreviewButton key={"filePreviewButton"} />
                                        <FileRenameButton key={"fileRenameButton"} />
                                        <TableCellMergeButton key={"tableCellMergeButton"} />
                                    </FormattingToolbar>
                                )}
                            />

                            <SuggestionMenuController
                                triggerCharacter={"@"}
                                getItems={async (query) =>
                                    filterSuggestionItems(
                                        MentionMenuItems(
                                            useTEM.teamMemberProfiles,
                                            editor,
                                            useTEM.teamMembers
                                        ),
                                        query
                                    )
                                }
                            />
                            <SuggestionMenuController
                                triggerCharacter={"/"}
                                getItems={async (query) =>
                                    filterSuggestionItems(
                                        getCustomSlashMenuItems(
                                            editor as unknown as typeof schema.BlockNoteEditor
                                        ),
                                        query
                                    )
                                }
                            />

                            {threadStore && <FloatingComposerController />}
                            {threadStore && !showThreadsSidebar && (
                                <ThreadsSidebarErrorBoundary>
                                    <FloatingThreadController />
                                </ThreadsSidebarErrorBoundary>
                            )}
                        </BlockNoteViewEditor>
                    </div>

                    {showThreadsSidebar && threadStore && (
                        <div className="bn-threads-sidebar-panel">
                            <ThreadsSidebarWithPreload filter="all" sort="position" />
                        </div>
                    )}
                </div>
            </BlockNoteView>

            <Modal open={opened} sx={{ zIndex: 10010 }} onClose={() => setOpened(false)}>
                <ModalDialog>
                    {selectedImage ? (
                        <Box>
                            <img alt="preview" src={selectedImage} />
                            <Tooltip
                                component="div"
                                placement="top"
                                size="sm"
                                sx={{ zIndex: 10010 }}
                                title="Download"
                                variant="outlined"
                            >
                                <IconButton
                                    color="neutral"
                                    sx={{ position: "absolute", top: "10px", right: "10px" }}
                                    variant="solid"
                                    onClick={() => handleDownload(selectedImage)}
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
