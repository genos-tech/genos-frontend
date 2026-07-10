import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "../../App.css";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
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
    BlockTypeSelect,
    BlockTypeSelectItem,
    blockTypeSelectItems,
    ColorStyleButton,
    CreateLinkButton,
    DefaultReactSuggestionItem,
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
import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useCollaborativeBlockNote } from "../../hooks/common/useCollaborativeBlockNote";
import { useDebouncedCallback } from "../../hooks/common/useDebouncedCallback";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { getUserColor } from "../../utils/collabUtils";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { downloadFile } from "../../utils/downloadUtils";
import { filterAndRankSuggestionItems } from "../../utils/suggestionRanking";
import { FileSizeRejectionSnackbar } from "../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadStatusBadge } from "../ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../ui/feedback/useFileSizeGuard";
import { useUploadCounter } from "../ui/feedback/useUploadCounter";
import { getEmojiSuggestionItems } from "./EmojiSuggestion";
import {
    CreateHashChatSpec,
    CreateHashNoteSpec,
    CreateHashProjectSpec,
    CreateHashTaskSpec,
    HashSuggestionMenuController,
} from "./HashMention";
import {
    CreateMentionGroupSpec,
    CreateMentionSpec,
    MentionMenuItems,
    MentionSuggestionMenu,
} from "./Mention";
import { Alert } from "./sub/Alert";
import { EDITOR_BODY_SYNC_DEBOUNCE_MS } from "./sub/bodySync";
import {
    codeBlockEnterShortcut,
    getBlockTypeSelectItemsWithCodeBlock,
} from "./sub/codeBlockExtras";
import { CustomDragHandleMenu } from "./sub/CustomDragHandleMenu";
import { ThreadsSidebarErrorBoundary } from "./sub/ThreadsSidebarErrorBoundary";
import { WrapToggleButtons } from "./sub/WrapToggleButtons";

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
    // Session-only wrap toggles. See `WrapToggleButtons` for the two
    // CSS classes added to the outer Box when each is on.
    const [unwrapAll, setUnwrapAll] = useState<boolean>(false);
    const [unwrapCode, setUnwrapCode] = useState<boolean>(false);
    const bnBoxClassName: string = [
        `bn-task-body-box-${mode}`,
        unwrapAll && "bn-unwrap-all",
        unwrapCode && "bn-unwrap-code",
    ]
        .filter(Boolean)
        .join(" ");
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const urlLinkModal = useUrlLinkModal();

    const { mentionGroups } = useMentionGroupsContext();

    // Memoized: `BlockNoteSchema.create` + the six spec factories are
    // non-trivial and the live editor only reads the schema when it is
    // (re)built — rebuilding the object on every render was pure waste,
    // and this component re-renders on every parent update. The deps are
    // exactly the values `CreateMentionSpec` closes over, so a rebuilt
    // schema is available whenever the editor is next recreated.
    const schema = useMemo(() => {
        // Disable the Audio and Video blocks from the built-in schema
        // This is done by picking out the blocks you want to disable
        const { audio, video, ...remainingBlockSpecs } = defaultBlockSpecs;
        return BlockNoteSchema.create({
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
                mentionGroup: CreateMentionGroupSpec(),
                hashTask: CreateHashTaskSpec(),
                hashNote: CreateHashNoteSpec(),
                hashChat: CreateHashChatSpec(),
                hashProject: CreateHashProjectSpec(),
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
    }, [useTEM.teamMemberProfiles, socket, myself, setMyself, useUISM, useCM]);

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
                    uploadTaskBodyAttachmentData.message ||
                        t.common.editor.taskBodyAttachmentUploadFailed
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
    useAnchorClickIntercept(editorRef, urlLinkModal);
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

    // Debounced document→parent sync. `onChange` fires on every keystroke;
    // serializing the whole document (`editor.document`), walking it for the
    // line count, and re-rendering the parent tree synchronously in that path
    // is what made typing lag. The document is read ONCE when the timer
    // fires, off the keystroke path. Flushed on blur so click-away flows
    // (e.g. the Create-Task submit button reading `body` state) see the
    // final content.
    //
    // Timer-path commits are transitions: `setBody` re-renders the whole
    // TaskPreview / CreateTaskForm tree, and when that render used to start
    // right as the user kept typing, the keystrokes buffered behind it and
    // appeared in a delayed burst. `startTransition` lets React abandon the
    // in-progress parent render for the urgent keystroke and redo it after.
    // The blur/flush path stays synchronous — its callers read `body`
    // immediately after flushing.
    const syncBodyToParent = useDebouncedCallback((isFlush?: boolean) => {
        const doc: any[] = editor.document;
        const commit = () => {
            setNumEditorLines(countLines(doc));
            setBody(doc);
        };
        if (isFlush) {
            commit();
        } else {
            startTransition(commit);
        }
    }, EDITOR_BODY_SYNC_DEBOUNCE_MS);

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
                <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}>
                    <WrapToggleButtons
                        setUnwrapAll={setUnwrapAll}
                        setUnwrapCode={setUnwrapCode}
                        unwrapAll={unwrapAll}
                        unwrapCode={unwrapCode}
                    />
                </Box>
                <BlockNoteView
                    className="bn-box"
                    comments={false}
                    editor={editor as any}
                    emojiPicker={false}
                    formattingToolbar={false}
                    // `false` so the custom `<SideMenuController>` below
                    // is the only side-menu controller attached. When
                    // this is `true`, BlockNote registers its own
                    // internal side menu and the custom one (with
                    // CustomDragHandleMenu) silently never wires up —
                    // hovering a line shows nothing. Mirrors the
                    // bnMyNoteEditor / bnTaskNoteEditor / bnChatNoteEditor
                    // setup.
                    sideMenu={false}
                    theme={mode === "dark" ? "dark" : "light"}
                    data-changing-font-demo
                    onBlur={() => syncBodyToParent.flush()}
                    onChange={() => {
                        // Heavy work (serialize + line count + parent
                        // re-render) is debounced; only the cheap edited/
                        // saved flags fire synchronously (no-ops after the
                        // first keystroke), preserving auto-save semantics.
                        syncBodyToParent.run();
                        if (setTaskBodyEdited) {
                            setTaskBodyEdited(true);
                            if (setTaskBodySaved) {
                                setTaskBodySaved(false);
                            }
                        }
                    }}
                    onClick={(e) => {
                        // Anchor clicks → useAnchorClickIntercept on
                        // editorRef (native capture phase). This handler
                        // only deals with image clicks.
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
                                        ...getBlockTypeSelectItemsWithCodeBlock(editor.dictionary),
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

                    {/* "#" mentions: tasks / notes / GM chats / projects */}
                    <HashSuggestionMenuController editor={editor} />
                    {/* Adds a mentions menu which opens with the "@" key */}
                    <SuggestionMenuController
                        suggestionMenuComponent={MentionSuggestionMenu}
                        triggerCharacter={"@"}
                        getItems={async (query) =>
                            // Gets the mentions menu items
                            filterAndRankSuggestionItems(
                                MentionMenuItems(
                                    useTEM.teamMemberProfiles,
                                    editor,
                                    useTEM.teamMembers,
                                    myself.userId,
                                    mentionGroups
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
                                    alt={t.common.editor.imagePreviewAlt}
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
                                    title={t.common.editor.download}
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
