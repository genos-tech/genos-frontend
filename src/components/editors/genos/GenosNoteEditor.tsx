import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "../../../App.css";

import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";
import { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
    BlockNoteViewEditor,
    FormattingToolbarController,
    SideMenu,
    SideMenuController,
} from "@blocknote/react";
import CheckIcon from "@mui/icons-material/Check";
import { Box, Chip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../context/AuthContext";
import { useMentionGroupsContext } from "../../../context/MentionGroupsContext";
import { getMyNoteRoleId, isNoteEditable } from "../../../features/notes/common/utils/noteRoles";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../../hooks/common/useAnchorClickIntercept";
import { useDebouncedCallback } from "../../../hooks/common/useDebouncedCallback";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { NoteRoleMember } from "../../../types/notes";
import { ImageZoomModal } from "../../messageBody/ImageZoomModal";
import { FileSizeRejectionSnackbar } from "../../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadStatusBadge } from "../../ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../../ui/feedback/useFileSizeGuard";
import { useUploadCounter } from "../../ui/feedback/useUploadCounter";
import { GifPicker } from "../../ui/gif/GifPicker";
import { headerTouchTargetsSx } from "../../ui/touchTargets";
import { useBlockNoteDictionary } from "../blockNoteI18n";
import { EDITOR_BODY_SYNC_DEBOUNCE_MS } from "../sub/bodySync";
import { CommentsWithMentions } from "../sub/CommentEditorWithMentions";
import { CommentHostContext } from "../sub/commentMentions";
import { COMMENTS_SIDEBAR_WIDTH, CommentsSidebar } from "../sub/CommentsSidebar";
import { CommentsSidebarToggle } from "../sub/CommentsSidebarToggle";
import { CustomDragHandleMenu } from "../sub/CustomDragHandleMenu";
import { useCommentMentionEmitter } from "../sub/useCommentMentionEmitter";
import { WrapToggleButtons } from "../sub/WrapToggleButtons";
import { GenosSuggestionMenus } from "./GenosSuggestionMenus";
import { GenosDocumentToolbar } from "./GenosToolbars";
import { useGenosCollabEditor } from "./useGenosEditor";

const base_url = import.meta.env.VITE_API_BASE_URL;
const django_url = import.meta.env.VITE_DJANGO_URL;

/**
 * What differs between the three note editors (my notes, task notes, chat notes). Every
 * other line of the editor is shared (MIP-1131): the three wrappers were identical copies of
 * ~780 lines apart from exactly these values.
 */
export type GenosNoteConfig = {
    noteId: number;
    title: string;
    /** Yjs document name prefix: the room is `${documentPrefix}:${noteId}`. */
    documentPrefix: string;
    /** Attachment upload endpoint, relative to the API base (`/note/personal/attachment/`). */
    uploadPath: string;
    /** Form fields the endpoint wants besides the file, `note_id` and `uploader`. */
    uploadFields?: Record<string, string>;
    /** Where a comment's @-mention is routed: the surface and its host ids. */
    commentHost: Omit<CommentHostContext, "noteId" | "title">;
    /** Name stem of a downloaded image: `${stem}-<timestamp>.png`. */
    imageFilenameStem: string;
};

export type GenosNoteEditorProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    note: GenosNoteConfig;
    body: any[];
    setBody: (text: PartialBlock[] | any[]) => void;
    setNoteBodyEdited?: (value: boolean) => void;
    setNoteBodySaved?: (value: boolean) => void;
    /** When true, render an inline "Saved" chip pinned to the left of
     *  the wrap-toggle buttons. Lives inside the editor (rather than
     *  the parent) so it follows the toggles' right-margin shift when
     *  the comments pane opens. */
    noteBodySaved?: boolean;
    /**
     * The note's title (`NoteTitleField`). It lives in the same flex row as the wrap toggles and
     * the Saved chip, so it takes the space the controls leave instead of a fixed share of the
     * width, and that row moves with the comments sidebar (MIP-1381).
     */
    titleSlot?: ReactNode;
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
export const GenosNoteEditor = (props: GenosNoteEditorProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        note,
        body,
        setBody,
        setNoteBodyEdited,
        setNoteBodySaved,
        noteBodySaved,
        titleSlot,
        useUISM,
        useCM,
        currentNoteMembers,
        resyncSignal,
    } = props;

    // Editor vs. viewer toggle, decided below once the collab scope is
    // known. A `null` explicit role is the implicit owner of an unshared
    // personal note — or a role the server resolves from elsewhere (a
    // Team Note folder grant), which only `collabScope` reveals.
    // Comments stay enabled in both modes.
    const myRoleId = getMyNoteRoleId(currentNoteMembers, myself.userId);

    // The @-picker offers the whole team, matching every other editor
    // (task note, chat note, chat, task comment).
    //
    // It used to be restricted to this note's explicit
    // `NotePermissionMaster` grants, on the reasoning that a personal
    // note has no implicit access path so that list was canonical. Two
    // things broke that:
    //
    //   * this editor now also serves TEAM notes, whose access comes
    //     from the FOLDER, not per-note grants — so `currentNoteMembers`
    //     is near-empty for them and the picker offered almost nobody;
    //   * it was only ever a proxy for "don't mention someone who can't
    //     see this", which the non-member-mention prompt now handles
    //     properly — it tells you, and offers to fix it.
    const mentionableUsers = useTEM.teamMembers;

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
    // Our custom comments sidebar (top-right button → docked list). Frontend
    // only: a read-only lens over the editor's existing threads.
    const [showComments, setShowComments] = useState<boolean>(false);
    const bnBoxClassName: string = [
        `bn-note-body-box-${mode}`,
        unwrapAll && "bn-unwrap-all",
        unwrapCode && "bn-unwrap-code",
    ]
        .filter(Boolean)
        .join(" ");

    const { mentionGroups } = useMentionGroupsContext();

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
            formData.append("note_id", String(note.noteId));
            for (const [field, value] of Object.entries(note.uploadFields ?? {})) {
                formData.append(field, value);
            }
            formData.append("uploader", myself.userId);
            const uploadNoteAttachmentResponse = await fetch(`${base_url}${note.uploadPath}`, {
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

    const documentName = `${note.documentPrefix}:${note.noteId}`;

    const { editor, threadStore, collabScope } = useGenosCollabEditor({
        documentName,
        ctx: {
            teamMemberProfiles: useTEM.teamMemberProfiles,
            socket,
            myself,
            setMyself,
            useUISM,
            useCM,
        },
        accessToken,
        dictionary,
        uploadFile,
        body,
    });
    const isEditable = isNoteEditable(myRoleId, collabScope);

    // Fan @-mentions left in inline comments out to the activity system, exactly as a note
    // body mention does. `note.commentHost` is the surface (6 my note, 7 task note, 8 chat
    // note) and its routing ids.
    useCommentMentionEmitter({
        threadStore,
        socket,
        getHost: () => ({ ...note.commentHost, noteId: note.noteId, title: note.title }),
    });

    const [showGifPicker, setShowGifPicker] = useState<boolean>(false);
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
    }, [note.noteId]);
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

    // State for modal
    const [opened, setOpened] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Custom click handler
    const handleImageClick = (src: string) => {
        setSelectedImage(src);
        setOpened(true);
    };

    return (
        <>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            <Box ref={editorBoxRef} className={bnBoxClassName} sx={{ position: "relative" }}>
                {/* Anchored bottom-right because the Comments toggle already
                lives at top-right of this editor. */}
                <FileUploadStatusBadge count={editorUploadCount} placement="bottom-right" />
                {/* Comments-sidebar toggle, pinned to the very top-right
                    corner. When the sidebar is open the cluster below shifts
                    left to clear the panel; this button stays put as the
                    open/close affordance. */}
                {threadStore && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            zIndex: 11,
                            ...headerTouchTargetsSx,
                        }}
                    >
                        <CommentsSidebarToggle
                            open={showComments}
                            threadStore={threadStore}
                            onToggle={() => setShowComments((prev) => !prev)}
                        />
                    </Box>
                )}
                <Box
                    sx={{
                        position: "absolute",
                        // Centred on the Comments toggle (top 8, 32px): the row is 40px tall.
                        top: 4,
                        minHeight: 40,
                        // Starts where the body text starts, so the title lines up with it.
                        left: "var(--note-body-start, 50px)",
                        // Closed: 52px clears the comment toggle at right:8.
                        // Open: the toggle sits over the sidebar header instead,
                        // so the cluster only needs to clear the panel's left
                        // edge — a snug 12px gap, not another 52.
                        right: showComments ? COMMENTS_SIDEBAR_WIDTH + 12 : 52,
                        // Above the editor: the title used to sit at 100 on its own.
                        zIndex: 100,
                        // The buttons are 44px on a touch screen (MIP-1319): the row is 44px
                        // tall, centred on the 44px comments toggle (top 8), and clears that
                        // toggle, not the 32px one.
                        "@media (pointer: coarse)": {
                            ...headerTouchTargetsSx["@media (pointer: coarse)"],
                            top: 8,
                            minHeight: 44,
                            right: showComments ? COMMENTS_SIDEBAR_WIDTH + 12 : 60,
                        },
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 1,
                        transition: "right 0.15s ease",
                        // The row is wide; only what is IN it takes clicks, never the empty
                        // stretch over the editor.
                        pointerEvents: "none",
                        "& > *": { pointerEvents: "auto" },
                    }}
                >
                    {titleSlot}
                    {/* "Saved" chip lives in the same row as the wrap
                        toggles. Anchored here instead of in the
                        parent (NoteEditor) so the two affordances stay
                        adjacent across every layout. Never shrunk: it is the
                        title that gives way. */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
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
                        onBlur={() => syncBodyToParent.flush()}
                        onBeforeInput={() => {
                            userInteractedRef.current = true;
                        }}
                        onClick={(e) => {
                            // Anchor clicks → useAnchorClickIntercept on
                            // editorBoxRef (native capture phase). This
                            // handler only deals with image clicks.
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
                                        <GenosDocumentToolbar
                                            editor={editor}
                                            isEditable={isEditable}
                                            hasComments={!!threadStore}
                                            setShowGifPicker={setShowGifPicker}
                                        />
                                    )}
                                />

                                {isEditable && (
                                    <GenosSuggestionMenus
                                        editor={editor}
                                        getMentionSources={() => ({
                                            teamMemberProfiles: useTEM.teamMemberProfiles,
                                            teamMembers: mentionableUsers,
                                            myselfUserId: myself.userId,
                                            mentionGroups,
                                        })}
                                        slash={{ preset: "document", setShowGifPicker }}
                                    />
                                )}

                                {threadStore && (
                                    <CommentsWithMentions
                                        myselfUserId={myself.userId}
                                        teamMemberProfiles={useTEM.teamMemberProfiles}
                                        teamMembers={mentionableUsers}
                                    />
                                )}
                            </BlockNoteViewEditor>
                        </div>
                        {threadStore && <CommentsSidebar open={showComments} />}
                    </div>
                </BlockNoteView>

                <ImageZoomModal
                    filenameStem={note.imageFilenameStem}
                    src={opened ? selectedImage : null}
                    onClose={() => setOpened(false)}
                />
            </Box>
        </>
    );
};
