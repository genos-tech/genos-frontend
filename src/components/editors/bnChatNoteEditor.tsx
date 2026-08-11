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
import { BlockNoteView } from "@blocknote/mantine";
import {
    AddCommentButton,
    BasicTextStyleButton,
    BlockNoteViewEditor,
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
    FormattingToolbar,
    FormattingToolbarController,
    getDefaultReactSlashMenuItems,
    SideMenu,
    SideMenuController,
    SuggestionMenuController,
    TableCellMergeButton,
    TextAlignButton,
} from "@blocknote/react";
import CheckIcon from "@mui/icons-material/Check";
import DownloadIcon from "@mui/icons-material/Download";
import { Box, Chip, IconButton, Modal, ModalDialog } from "@mui/joy";
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
import { useDebouncedCallback } from "../../hooks/common/useDebouncedCallback";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { ChatNoteProps, NoteRoleMember } from "../../types/notes";
import { getUserColor } from "../../utils/collabUtils";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { downloadFile } from "../../utils/downloadUtils";
import { filterAndRankSuggestionItems } from "../../utils/suggestionRanking";
import { AppTooltip } from "../ui/AppTooltip";
import { FileSizeRejectionSnackbar } from "../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadStatusBadge } from "../ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../ui/feedback/useFileSizeGuard";
import { useUploadCounter } from "../ui/feedback/useUploadCounter";
import { GifPicker } from "../ui/gif/GifPicker";
import { useBlockNoteDictionary } from "./blockNoteI18n";
import { CreateCustomEmojiSpec, insertEmojiValue } from "./CustomEmoji";
import { getEmojiSuggestionItems } from "./EmojiSuggestion";
import { GifToolbarButton, withGifSlashItem } from "./GifToolbarButton";
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
import { buildCommentSchema, CommentsWithMentions } from "./sub/CommentEditorWithMentions";
import { CustomDragHandleMenu } from "./sub/CustomDragHandleMenu";
import { useCommentMentionEmitter } from "./sub/useCommentMentionEmitter";
import { WrapToggleButtons } from "./sub/WrapToggleButtons";

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
    /** When true, render an inline "Saved" chip pinned to the left of
     *  the wrap-toggle buttons. Lives inside the editor so it follows
     *  the toggles' shift when the comments pane opens. */
    noteBodySaved?: boolean;
    useUISM: UIStateManagementState;
    /** Explicit note-role members. Used to gate edit affordances —
     *  Viewers see the body but only the comment-add button. The
     *  caller passes `useNM.currentNoteMembers` directly. */
    currentNoteMembers: NoteRoleMember[];
    // See `BnMyNoteEditor` — bumped on restore so we can push the new
    // body into the live Yjs doc via `editor.replaceBlocks`.
    resyncSignal?: number | string;
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
        noteBodySaved,
        useUISM,
        useCM,
        currentNoteMembers,
        resyncSignal,
    } = props;

    // Editor vs. viewer toggle. See `bnMyNoteEditor` for the
    // rationale on the `null` (implicit-owner) branch.
    const myRoleId = getMyNoteRoleId(currentNoteMembers, myself.userId);
    const isEditable = isNoteEditableForRole(myRoleId);

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

    const { mentionGroups } = useMentionGroupsContext();

    // Memoized: see `bnTaskPreview` — schema construction is non-trivial,
    // the live editor only reads it at (re)build time, and this component
    // re-renders on every parent update. Deps are exactly the values
    // `CreateMentionSpec` closes over.
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
                customEmoji: CreateCustomEmojiSpec(),
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

    // Mention-capable schema for the inline body-COMMENT editors (composer,
    // reply, edit). Handed to `CommentsExtension` so `@`/`#` chips render in
    // comments. Same deps as the main `schema` — `CreateMentionSpec` closes
    // over these values.
    const commentSchema = useMemo(
        () =>
            buildCommentSchema({
                teamMemberProfiles: useTEM.teamMemberProfiles,
                socket,
                myself,
                setMyself,
                useUISM,
                useCM,
            }),
        [useTEM.teamMemberProfiles, socket, myself, setMyself, useUISM, useCM]
    );

    // List containing all default Slash Menu Items, as well as our custom one.
    const getCustomSlashMenuItems = (
        editor: typeof schema.BlockNoteEditor
    ): DefaultReactSuggestionItem[] =>
        withGifSlashItem(getDefaultReactSlashMenuItems(editor), setShowGifPicker);

    // See `bnChatEditor` for the rationale on `useUploadCounter`.
    const { activeCount: editorUploadCount, wrap: trackUpload } = useUploadCounter();

    // Per-file size cap. See `bnChatEditor` for the rationale.
    const { rejection, dismissRejection, guardUploadFile } = useFileSizeGuard();

    const uploadFile = guardUploadFile(
        trackUpload(async (file: File) => {
            const formData = new FormData();
            formData.append("note_attachment_file", file);
            formData.append("note_id", String(currentChatNote.noteId));
            formData.append("uploader", myself.userId);
            // ChatNoteAttachmentFact carries the chat-routing tuple
            // (chat_type / chat_id / is_thread / thread_id) as NOT
            // NULL columns so the file can be linked back to the
            // exact chat surface it was dropped onto. The task-note
            // counterpart skips these (its model only requires
            // `note` + `uploader`), which is why this editor used to
            // 400 while `bnTaskNoteEditor` worked with the same
            // payload shape.
            formData.append("chat_type", String(currentChatNote.chatType));
            formData.append("chat_id", String(currentChatNote.chatId));
            formData.append("is_thread", String(currentChatNote.isThread));
            formData.append("thread_id", String(currentChatNote.threadId));
            const uploadNoteAttachmentResponse = await fetch(`${base_url}/note/chat/attachment/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            });
            const uploadNoteAttachmentData = await uploadNoteAttachmentResponse.json();

            if (!uploadNoteAttachmentResponse.ok) {
                throw new Error(
                    uploadNoteAttachmentData.message || t.common.editor.attachmentUploadFailed
                );
            }

            return `${django_url}${uploadNoteAttachmentData.noteAttachmentUrl}`;
        })
    );

    const dictionary = useBlockNoteDictionary();

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
        commentSchema,
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

    // Fan @-mentions left in inline comments out to the activity system,
    // exactly as a chat-note body mention does. Host = chat note (surface 8),
    // carrying the parent chat's routing so the mention can deep-link to the
    // note inside its chat.
    useCommentMentionEmitter({
        threadStore,
        socket,
        getHost: () => ({
            surfaceType: 8,
            noteId: currentChatNote.noteId,
            title: currentChatNote.title,
            chatType: currentChatNote.chatType,
            chatId: currentChatNote.chatId,
            threadId: currentChatNote.threadId,
        }),
    });

    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [showGifPicker, setShowGifPicker] = useState<boolean>(false);
    const [selectedEmoji, setSelectedEmoji] = useState<any>(null);
    const insertEmoji = (emoji: any) => {
        // ":name:" shortcodes from the picker's Team Emoji category
        // become customEmoji inline nodes; unicode stays plain text.
        insertEmojiValue(editor, emoji);
        setShowEmojiPicker(false);
    };
    const insertGif = (gif: { url: string; title: string }) => {
        // Standard image block: every read surface already renders and
        // animates it (same path as an uploaded GIF file).
        // `as any`: these collab editors are strictly schema-typed (the
        // chat editors' `editor` is loose), and the PartialBlock union
        // rejects a fresh image-props literal under tsc -b. Same idiom
        // as the `editor as any` these files already use for
        // BlockNoteView.
        (editor as any).insertBlocks(
            [{ type: "image", props: { url: gif.url, name: gif.title } }],
            editor.getTextCursorPosition().block,
            "after"
        );
        setShowGifPicker(false);
    };

    // Push the restored body into the live Yjs doc on a parent-bumped
    // `resyncSignal`. See `BnMyNoteEditor` for the rationale.
    const restoredBodyRef = useRef(body);
    restoredBodyRef.current = body;
    const lastSeenResyncRef = useRef(resyncSignal);

    // See `bnMyNoteEditor` for the full rationale. Gates the
    // "edited" signal on real DOM user input so opening a note
    // doesn't fire an auto-save.
    const userInteractedRef = useRef(false);
    useEffect(() => {
        userInteractedRef.current = false;
    }, [currentChatNote?.noteId]);
    useEffect(() => {
        if (lastSeenResyncRef.current === resyncSignal) return;
        lastSeenResyncRef.current = resyncSignal;
        if (!editor) return;
        const next = restoredBodyRef.current;
        // BlockNote requires at least one block; substitute an empty
        // paragraph when the restored body is empty so the editor
        // visibly clears.
        const replacement = next && next.length > 0 ? next : [{ type: "paragraph" }];
        try {
            (editor as any).replaceBlocks(editor.document, replacement);
        } catch {
            // Best-effort
        }
    }, [resyncSignal, editor]);

    // Debounced document→parent sync. `onChange` fires on every keystroke;
    // serializing the whole document (`editor.document`) and re-rendering
    // the parent tree synchronously in that path is what made typing lag.
    // Flushed on blur so click-away flows read the final content; Yjs is
    // the authoritative store either way.
    //
    // Timer-path commits are transitions: when the panel re-render used to
    // start right as the user kept typing, keystrokes buffered behind it
    // and appeared in a delayed burst. `startTransition` lets React abandon
    // the parent render for the urgent keystroke. The blur/flush path stays
    // synchronous — its callers read `body` immediately after flushing.
    const syncBodyToParent = useDebouncedCallback((isFlush?: boolean) => {
        const doc = editor.document;
        if (isFlush) {
            setBody(doc);
        } else {
            startTransition(() => setBody(doc));
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
        filename = `chat-note-image-${getLocalCurrentTimestamp()}.png`
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
                <Box
                    sx={{
                        position: "absolute",
                        top: 8,
                        right: 52,
                        zIndex: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                    }}
                >
                    {/* "Saved" chip rides alongside the wrap toggles. */}
                    {noteBodySaved && (
                        <Chip
                            color="neutral"
                            size="sm"
                            startDecorator={<CheckIcon sx={{ fontSize: 14 }} />}
                            variant="soft"
                            sx={{
                                fontWeight: 500,
                                fontSize: "13px",
                                "--Chip-paddingInline": "10px",
                                animation: "fadeIn 0.3s ease-in-out",
                                "@keyframes fadeIn": {
                                    from: { opacity: 0, transform: "scale(0.95)" },
                                    to: { opacity: 1, transform: "scale(1)" },
                                },
                            }}
                        >
                            {t.notes.editor.savedChip}
                        </Chip>
                    )}
                    <WrapToggleButtons
                        setUnwrapAll={setUnwrapAll}
                        setUnwrapCode={setUnwrapCode}
                        unwrapAll={unwrapAll}
                        unwrapCode={unwrapCode}
                    />
                </Box>

                <GifPicker
                    pickerLeftPosition="calc(50vw - 170px)"
                    pickerTopPosition="15vh"
                    setShowGifPicker={setShowGifPicker}
                    showGifPicker={showGifPicker}
                    useFixedPosition={true}
                    onSelect={insertGif}
                />
                <BlockNoteView
                    className="bn-box"
                    comments={false}
                    editable={isEditable}
                    editor={editor as any}
                    emojiPicker={false}
                    // A custom "/" SuggestionMenuController is mounted below —
                    // the built-in menu must be off or BOTH render on "/",
                    // stacking duplicate group labels (the "Media x3" bug).
                    slashMenu={false}
                    formattingToolbar={false}
                    renderEditor={false}
                    sideMenu={false}
                    theme={mode === "dark" ? "dark" : "light"}
                    data-changing-font-demo
                    onChange={() => {
                        // Heavy work (serialize + parent re-render) is
                        // debounced off the keystroke path; the cheap
                        // edited/saved flags stay synchronous (no-ops after
                        // the first keystroke), preserving auto-save
                        // semantics.
                        syncBodyToParent.run();
                        // See `userInteractedRef` for why this is
                        // gated rather than always firing.
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
                        onBlur={() => syncBodyToParent.flush()}
                        onBeforeInput={() => {
                            userInteractedRef.current = true;
                        }}
                        onClick={(e) => {
                            // Anchor clicks are intercepted by
                            // `useAnchorClickIntercept` (native
                            // capture-phase listener on `editorBoxRef`).
                            // This handler only deals with image clicks.
                            const target = e.target as HTMLElement;
                            if (
                                target.tagName === "IMG" &&
                                !target.hasAttribute("data-custom-emoji")
                            ) {
                                // (custom emoji are inline <img>s, not
                                // zoomable/downloadable image blocks)
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
                                                            name: t.common.editor.alertBlock,
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
                                                    <GifToolbarButton
                                                        key={"gifButton"}
                                                        setShowGifPicker={setShowGifPicker}
                                                    />
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
                                    // Chat notes inherit access from the
                                    // underlying chat (DM partner / GM /
                                    // project / MDM members) plus explicit
                                    // NotePermissionMaster grants. The
                                    // picker stays scoped to the whole
                                    // team for now — most teams are small
                                    // enough that non-members in the list
                                    // are rare, and the backend's
                                    // always-notify rule + 403-on-click
                                    // path covers the rest.
                                    <SuggestionMenuController
                                        suggestionMenuComponent={MentionSuggestionMenu}
                                        triggerCharacter={"@"}
                                        getItems={async (query) =>
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
                                )}
                                {isEditable && <HashSuggestionMenuController editor={editor} />}
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

                                {threadStore && (
                                    <CommentsWithMentions
                                        myselfUserId={myself.userId}
                                        teamMemberProfiles={useTEM.teamMemberProfiles}
                                        teamMembers={useTEM.teamMembers}
                                    />
                                )}
                            </BlockNoteViewEditor>
                        </div>
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
                                <AppTooltip
                                    placement="top"
                                    size="sm"
                                    title={t.common.editor.download}
                                >
                                    <IconButton
                                        color="neutral"
                                        sx={{ position: "absolute", top: "10px", right: "10px" }}
                                        variant="solid"
                                        onClick={() => handleDownload(selectedImage)}
                                    >
                                        <DownloadIcon />
                                    </IconButton>
                                </AppTooltip>
                            </Box>
                        ) : null}
                    </ModalDialog>
                </Modal>
            </Box>
        </>
    );
};
