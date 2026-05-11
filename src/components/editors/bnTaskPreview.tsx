import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "../../App.css";

import { useEffect, useMemo, useRef, useState } from "react";
import { codeBlockOptions } from "@blocknote/code-block";
import {
    BlockNoteSchema,
    createCodeBlockSpec,
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
import { getUserColor } from "../../utils/collabUtils";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { downloadFile } from "../../utils/downloadUtils";
import { FileSizeRejectionSnackbar } from "../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadStatusBadge } from "../ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../ui/feedback/useFileSizeGuard";
import { useUploadCounter } from "../ui/feedback/useUploadCounter";
import { getEmojiSuggestionItems } from "./EmojiSuggestion";
import { CreateMentionSpec, MentionMenuItems } from "./Mention";
import { Alert } from "./sub/Alert";
import { codeBlockEnterShortcut } from "./sub/codeBlockExtras";
import { ResetBlockTypeItem } from "./sub/ResetBlockTypeItem";
import { ThreadsSidebarErrorBoundary } from "./sub/ThreadsSidebarErrorBoundary";

const base_url = import.meta.env.VITE_API_BASE_URL;
const django_url = import.meta.env.VITE_DJANGO_URL;

type BnTaskPreviewProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    taskId: number;
    body: any[];
    setBody: (text: PartialBlock[] | any[]) => void;
    setTaskBodyEdited?: (value: boolean) => void;
    setTaskBodySaved?: (value: boolean) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    /** Called once after the BlockNote editor instance is ready. Used by the
     *  task creation form so it can imperatively swap templates via
     *  `editor.replaceBlocks(...)`. */
    onEditorReady?: (editor: any) => void;
};
export const BnTaskPreview = (props: BnTaskPreviewProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        taskId,
        body,
        setBody,
        setTaskBodyEdited,
        setTaskBodySaved,
        useCM,
        useUISM,
        onEditorReady,
    } = props;

    const { mode } = useColorScheme();
    const bnBoxClassName: string = `bn-task-body-box-${mode}`;
    const { accessToken } = useAuth();

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
            // BlockNote 0.49 moved the code-block options out of
            // `useCreateBlockNote` and into the schema. We override
            // the default plain-text codeBlock with the syntax-
            // highlighted one shipped by `@blocknote/code-block`.
            codeBlock: createCodeBlockSpec(codeBlockOptions),
            alert: Alert(),
        },
    });

    // List containing all default Slash Menu Items, as well as our custom one.
    const getCustomSlashMenuItems = (
        editor: typeof schema.BlockNoteEditor
    ): DefaultReactSuggestionItem[] => getDefaultReactSlashMenuItems(editor);

    // See `bnChatEditor` for the rationale on `useUploadCounter`.
    const { activeCount: editorUploadCount, wrap: trackUpload } = useUploadCounter();

    // Per-file size cap. See `bnChatEditor` for the rationale.
    const { rejection, dismissRejection, guardUploadFile } = useFileSizeGuard();

    const uploadFile = guardUploadFile(
        trackUpload(async (file: File) => {
            const formData = new FormData();
            formData.append("body_attachment_file", file);
            formData.append("task_id", String(taskId));
            formData.append("uploader", myself.userId);
            const uploadTaskBodyAttachmentResponse = await fetch(
                `${base_url}/task/body/attachment/`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: formData,
                }
            );
            const uploadTaskBodyAttachmentData = await uploadTaskBodyAttachmentResponse.json();

            if (!uploadTaskBodyAttachmentResponse.ok) {
                throw new Error(
                    uploadTaskBodyAttachmentData.message || "Task BodyAttachment Upload Failed"
                );
            }

            return `${django_url}${uploadTaskBodyAttachmentData.taskBodyAttachmentUrl}`;
        })
    );

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

    const documentName = `task-body:${taskId}`;

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
        // `codeBlockEnterShortcut` augments the built-in
        // ``` + Space input rule with an Enter-key handler, so
        // users get the same Markdown shortcut they expect.
        extensions: [codeBlockEnterShortcut],
    });

    // Forward the editor instance to the parent the first time it becomes
    // available. CreateTaskForm uses this to swap templates imperatively.
    const editorReadyRef = useRef(false);
    useEffect(() => {
        if (editor && !editorReadyRef.current && onEditorReady) {
            editorReadyRef.current = true;
            onEditorReady(editor);
        }
    }, [editor, onEditorReady]);

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

    const [numEditorLines, setNumEditorLines] = useState<number>(0);

    const editorRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (editorRef.current) {
            const dynamicHeight: number = Math.min(
                Math.max(numEditorLines - 13, 0) * 20 + 500,
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
        filename = `task-preview-image-${getLocalCurrentTimestamp()}.png`
    ) => {
        await downloadFile(url, filename);
    };

    return (
        <>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            <Box ref={editorRef} className={bnBoxClassName} sx={{ position: "relative" }}>
                <FileUploadStatusBadge count={editorUploadCount} />
                <BlockNoteView
                    className="bn-box"
                    comments={false}
                    editor={editor as any}
                    emojiPicker={false}
                    formattingToolbar={false}
                    sideMenu={true}
                    theme={mode === "dark" ? "dark" : "light"}
                    data-changing-font-demo
                    onChange={() => {
                        const comments: any[] = editor.document;
                        setNumEditorLines(countLines(comments));
                        setBody(editor.document);
                        if (setTaskBodyEdited) {
                            setTaskBodyEdited(true);
                            if (setTaskBodySaved) {
                                setTaskBodySaved(false);
                            }
                        }
                    }}
                    onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.tagName === "IMG") {
                            handleImageClick((target as HTMLImageElement).src);
                        }
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            if (editor.document.length > 1) {
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
                                {threadStore && <AddCommentButton key={"addCommentButton"} />}
                                <FileDeleteButton key={"fileDeleteButton"} />
                                <FileDownloadButton key={"fileDownloadButton"} />
                                <FilePreviewButton key={"filePreviewButton"} />
                                <FileRenameButton key={"fileRenameButton"} />
                                <TableCellMergeButton key={"tableCellMergeButton"} />
                            </FormattingToolbar>
                        )}
                    />

                    {/* Adds a mentions menu which opens with the "@" key */}
                    <SuggestionMenuController
                        triggerCharacter={"@"}
                        getItems={async (query) =>
                            // Gets the mentions menu items
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
                    <SuggestionMenuController
                        getItems={async (query) => getEmojiSuggestionItems(editor, query)}
                        minQueryLength={2}
                        triggerCharacter={":"}
                    />

                    {threadStore && <FloatingComposerController />}
                    {threadStore && (
                        <ThreadsSidebarErrorBoundary>
                            <FloatingThreadController />
                        </ThreadsSidebarErrorBoundary>
                    )}
                </BlockNoteView>

                <Modal open={opened} sx={{ zIndex: 10010 }} onClose={() => setOpened(false)}>
                    <ModalDialog>
                        {selectedImage ? (
                            <Box>
                                <img
                                    alt="preview"
                                    src={selectedImage}
                                    style={{
                                        maxWidth: "80vw",
                                        maxHeight: "80vh",
                                        display: "block",
                                    }}
                                />
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
        </>
    );
};
