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
import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import {
    getMyNoteRoleId,
    isNoteEditableForRole,
} from "../../features/notes/common/utils/noteRoles";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useCollaborativeBlockNote } from "../../hooks/common/useCollaborativeBlockNote";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { MyNoteProps, NoteRoleMember } from "../../types/notes";
import { getUserColor } from "../../utils/collabUtils";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { downloadFile } from "../../utils/downloadUtils";
import { AppTooltip } from "../ui/AppTooltip";
import { FileSizeRejectionSnackbar } from "../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadStatusBadge } from "../ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../ui/feedback/useFileSizeGuard";
import { useUploadCounter } from "../ui/feedback/useUploadCounter";
import { getEmojiSuggestionItems } from "./EmojiSuggestion";
import {
    CreateMentionGroupSpec,
    CreateMentionSpec,
    MentionMenuItems,
    MentionSuggestionMenu,
} from "./Mention";
import { Alert } from "./sub/Alert";
import {
    codeBlockEnterShortcut,
    getBlockTypeSelectItemsWithCodeBlock,
} from "./sub/codeBlockExtras";
import { ResetBlockTypeItem } from "./sub/ResetBlockTypeItem";
import { ThreadsSidebarErrorBoundary } from "./sub/ThreadsSidebarErrorBoundary";
import { ThreadsSidebarWithPreload } from "./sub/ThreadsSidebarWithPreload";
import { WrapToggleButtons } from "./sub/WrapToggleButtons";

const base_url = import.meta.env.VITE_API_BASE_URL;
const django_url = import.meta.env.VITE_DJANGO_URL;

type BnMyNoteEditorProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    currentMyNote: MyNoteProps;
    body: any[];
    setBody: (text: PartialBlock[] | any[]) => void;
    setNoteBodyEdited?: (value: boolean) => void;
    setNoteBodySaved?: (value: boolean) => void;
    useUISM: UIStateManagementState;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    /** Explicit note-role members. Used to gate edit affordances —
     *  Viewers see the body but only the comment-add button. The
     *  caller passes `useNM.currentNoteMembers` directly. */
    currentNoteMembers: NoteRoleMember[];
    // Bumped by `useNoteManagement.restoreNoteVersion` after a successful
    // restore. On change, we push `body` into the live Yjs doc via
    // `editor.replaceBlocks`, which syncs the restored content to
    // Hocuspocus / IDB persistence / all collaborators. Without this the
    // editor keeps rendering Yjs's existing CRDT state (the pre-restore
    // body) even though local React state was updated.
    resyncSignal?: number | string;
};
export const BnMyNoteEditor = (props: BnMyNoteEditorProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        currentMyNote,
        body,
        setBody,
        setNoteBodyEdited,
        setNoteBodySaved,
        useUISM,
        useCM,
        currentNoteMembers,
        resyncSignal,
    } = props;

    // Editor vs. viewer toggle. `null` (no explicit grant) means the
    // user is the implicit owner of an unshared personal note —
    // treat as editable. Comments stay enabled in both modes.
    const myRoleId = getMyNoteRoleId(currentNoteMembers, myself.userId);
    const isEditable = isNoteEditableForRole(myRoleId);

    // Restrict the @-suggestion picker to users who have explicit
    // access to this note (the owner + anyone granted a role via
    // `NotePermissionMaster`). Personal notes have no implicit access
    // path, so this is the canonical list. Preventative UX only —
    // backend still notifies via the `note_mention` socket event for
    // any user who slips through (e.g., role revoked mid-session).
    const mentionableUsers = currentNoteMembers
        .map((m) => useTEM.teamMemberProfiles[m.userId])
        .filter((u): u is NonNullable<typeof u> => !!u);

    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const urlLinkModal = useUrlLinkModal();
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);
    // Session-only wrap toggles. See `WrapToggleButtons` for the two
    // CSS classes added to the outer Box when each is on.
    const [unwrapAll, setUnwrapAll] = useState<boolean>(false);
    const [unwrapCode, setUnwrapCode] = useState<boolean>(false);
    const bnBoxClassName: string = [
        `bn-note-body-box-${mode}`,
        unwrapAll && "bn-unwrap-all",
        unwrapCode && "bn-unwrap-code",
    ]
        .filter(Boolean)
        .join(" ");

    // To avoid rendering issues, it's good practice to define your custom drag
    // handle menu in a separate component, instead of inline within the `sideMenu`
    // prop of `SideMenuController`.
    const CustomDragHandleMenu = () => (
        <DragHandleMenu>
            <RemoveBlockItem>{t.common.editor.delete}</RemoveBlockItem>
            <BlockColorsItem>{t.common.editor.colors}</BlockColorsItem>
            {/* Item which resets the hovered block's type. */}
            <ResetBlockTypeItem>{t.common.editor.resetType}</ResetBlockTypeItem>
        </DragHandleMenu>
    );

    // Disable the Audio and Image blocks from the built-in schema
    // This is done by picking out the blocks you want to disable
    const { audio, video, ...remainingBlockSpecs } = defaultBlockSpecs;

    const { mentionGroups } = useMentionGroupsContext();

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
            mentionGroup: CreateMentionGroupSpec(),
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

    // Counter wraps `uploadFile` so the editor surfaces a small
    // "Uploading n file(s)…" pill for the duration of any in-flight
    // POST. See `bnChatEditor` for the rationale.
    const { activeCount: editorUploadCount, wrap: trackUpload } = useUploadCounter();

    // Per-file size cap. See `bnChatEditor` for the rationale.
    const { rejection, dismissRejection, guardUploadFile } = useFileSizeGuard();

    const uploadFile = guardUploadFile(
        trackUpload(async (file: File) => {
            const formData = new FormData();
            formData.append("note_attachment_file", file);
            formData.append("note_id", String(currentMyNote.noteId));
            formData.append("uploader", myself.userId);
            const uploadNoteAttachmentResponse = await fetch(
                `${base_url}/note/personal/attachment/`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: formData,
                }
            );
            const uploadNoteAttachmentData = await uploadNoteAttachmentResponse.json();

            if (!uploadNoteAttachmentResponse.ok) {
                throw new Error(
                    uploadNoteAttachmentData.message || t.common.editor.attachmentUploadFailed
                );
            }

            return `${django_url}${uploadNoteAttachmentData.noteAttachmentUrl}`;
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

    const documentName = `my-note:${currentMyNote.noteId}`;

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

    const [showThreadsSidebar, setShowThreadsSidebar] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const insertEmoji = (emoji: any) => {
        editor.insertInlineContent([{ type: "text", text: emoji, styles: {} }]);
        setShowEmojiPicker(false);
    };

    // Push the restored body into the live Yjs doc when the parent bumps
    // `resyncSignal`. The first render is skipped so we don't clobber the
    // initial seed on mount; subsequent changes correspond to a restore
    // and trigger a Yjs replace (which syncs to Hocuspocus + IDB + all
    // other collaborators).
    const restoredBodyRef = useRef(body);
    restoredBodyRef.current = body;
    const lastSeenResyncRef = useRef(resyncSignal);

    // Distinguish "real user input" from "initial sync" / "collab
    // remote update" so opening a note doesn't trigger an auto-save.
    // BlockNote fires `onChange` once the editor finishes loading the
    // initial body (and again on every Yjs sync tick), and the
    // previous version of this component called `setNoteBodyEdited(true)`
    // from inside that handler unconditionally — arming the
    // `useNoteEditorCore` debounce timer for a save no one asked for.
    // We flip this ref to true on actual DOM input events
    // (keypress, paste, drop, IME composition) and gate the
    // "edited" signal on it. The ref resets to false every time the
    // user opens a different note.
    const userInteractedRef = useRef(false);
    useEffect(() => {
        userInteractedRef.current = false;
    }, [currentMyNote?.noteId]);
    useEffect(() => {
        if (lastSeenResyncRef.current === resyncSignal) return;
        lastSeenResyncRef.current = resyncSignal;
        if (!editor) return;
        const next = restoredBodyRef.current;
        // BlockNote requires at least one block; if the restored body is
        // empty, substitute a single empty paragraph so the editor
        // visibly clears instead of silently keeping the previous content.
        const replacement = next && next.length > 0 ? next : [{ type: "paragraph" }];
        try {
            (editor as any).replaceBlocks(editor.document, replacement);
        } catch {
            // Best-effort: if the editor isn't ready yet, the next render
            // will pick up the seeded body via useCollaborativeBlockNote's
            // retry effect.
        }
    }, [resyncSignal, editor]);

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
        <>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            <Box ref={editorBoxRef} className={bnBoxClassName} sx={{ position: "relative" }}>
                {/* Anchored bottom-right because the Comments toggle already
                lives at top-right of this editor. */}
                <FileUploadStatusBadge count={editorUploadCount} placement="bottom-right" />
                <AppTooltip
                    placement="top"
                    size="sm"
                    title={showThreadsSidebar ? "Hide Comments" : "Show Comments"}
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
                </AppTooltip>
                <Box
                    sx={{
                        position: "absolute",
                        top: 8,
                        zIndex: 10,
                        // When the threads sidebar opens it takes the
                        // right half of the editor — the toggles would
                        // float over the comments pane instead of the
                        // editor. Swap to the comment-pane-left in that case
                        // so they stay over the content being wrapped.
                        ...(showThreadsSidebar ? { right: 370 } : { right: 52 }),
                    }}
                >
                    <WrapToggleButtons
                        unwrapAll={unwrapAll}
                        setUnwrapAll={setUnwrapAll}
                        unwrapCode={unwrapCode}
                        setUnwrapCode={setUnwrapCode}
                    />
                </Box>

                <BlockNoteView
                    className="bn-box"
                    comments={false}
                    editable={isEditable}
                    editor={editor as any}
                    emojiPicker={false}
                    formattingToolbar={false}
                    renderEditor={false}
                    sideMenu={false}
                    theme={mode === "dark" ? "dark" : "light"}
                    data-changing-font-demo
                    onChange={() => {
                        setBody(editor.document);
                        // Only count this as a real edit if the user
                        // has actually typed / pasted / dropped since
                        // opening the note. See `userInteractedRef`
                        // above for the rationale.
                        if (userInteractedRef.current && setNoteBodyEdited) {
                            setNoteBodyEdited(true);
                            if (setNoteBodySaved) {
                                setNoteBodySaved(false);
                            }
                        }
                    }}
                >
                    <div
                        className="bn-editor-with-sidebar"
                        onBeforeInput={() => {
                            userInteractedRef.current = true;
                        }}
                        onClick={(e) => {
                            // Anchor clicks → useAnchorClickIntercept on
                            // editorBoxRef (native capture phase). This
                            // handler only deals with image clicks.
                            const target = e.target as HTMLElement;
                            if (target.tagName === "IMG") {
                                handleImageClick((target as HTMLImageElement).src);
                            }
                        }}
                        onCompositionStart={() => {
                            userInteractedRef.current = true;
                        }}
                        onDrop={() => {
                            userInteractedRef.current = true;
                        }}
                        onKeyDown={(event) => {
                            // Ignore plain modifier-only events (Shift,
                            // Ctrl, Cmd, Meta) — they shouldn't mark
                            // the note as "edited" by themselves.
                            if (
                                event.key !== "Shift" &&
                                event.key !== "Control" &&
                                event.key !== "Meta" &&
                                event.key !== "Alt"
                            ) {
                                userInteractedRef.current = true;
                            }
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                if (editor.document.length > 1) {
                                    //Auto saving logic here
                                }
                            }
                        }}
                        onPaste={() => {
                            userInteractedRef.current = true;
                        }}
                    >
                        <div className="bn-editor-section">
                            <BlockNoteViewEditor>
                                {isEditable && (
                                    <SideMenuController
                                        sideMenu={(props) => (
                                            <SideMenu
                                                {...props}
                                                dragHandleMenu={CustomDragHandleMenu}
                                            />
                                        )}
                                    />
                                )}
                                <FormattingToolbarController
                                    formattingToolbar={() => (
                                        <FormattingToolbar>
                                            {isEditable && (
                                                <BlockTypeSelect
                                                    key={"blockTypeSelect"}
                                                    items={[
                                                        ...getBlockTypeSelectItemsWithCodeBlock(
                                                            editor.dictionary
                                                        ),
                                                        {
                                                            name: "Alert",
                                                            type: "alert",
                                                            icon: RiAlertFill,
                                                        } satisfies BlockTypeSelectItem,
                                                    ]}
                                                />
                                            )}

                                            {isEditable && (
                                                <>
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
                                                </>
                                            )}
                                            {threadStore && (
                                                <AddCommentButton key={"addCommentButton"} />
                                            )}
                                            {isEditable && (
                                                <>
                                                    <FileDeleteButton key={"fileDeleteButton"} />
                                                    <FileDownloadButton
                                                        key={"fileDownloadButton"}
                                                    />
                                                    <FilePreviewButton key={"filePreviewButton"} />
                                                    <FileRenameButton key={"fileRenameButton"} />
                                                    <TableCellMergeButton
                                                        key={"tableCellMergeButton"}
                                                    />
                                                </>
                                            )}
                                        </FormattingToolbar>
                                    )}
                                />

                                {isEditable && (
                                    <SuggestionMenuController
                                        triggerCharacter={"@"}
                                        suggestionMenuComponent={MentionSuggestionMenu}
                                        getItems={async (query) =>
                                            filterSuggestionItems(
                                                MentionMenuItems(
                                                    useTEM.teamMemberProfiles,
                                                    editor,
                                                    mentionableUsers,
                                                    myself.userId,
                                                    mentionGroups
                                                ),
                                                query
                                            )
                                        }
                                    />
                                )}
                                {isEditable && (
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
                                )}
                                {isEditable && (
                                    <SuggestionMenuController
                                        minQueryLength={2}
                                        triggerCharacter={":"}
                                        getItems={async (query) =>
                                            getEmojiSuggestionItems(editor, query)
                                        }
                                    />
                                )}

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
