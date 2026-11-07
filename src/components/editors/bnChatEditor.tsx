import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { hasSendableContent, withTrailingBlank } from "./utils/messageBlocks";

import { useAuth } from "../../context/AuthContext";
import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { sendChatMessage } from "../../features/chat/services/sendChatMessage";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useEditorDraft } from "../../hooks/common/useEditorDraft";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { channelService } from "../../services/channel/channelService";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
import { FileSizeRejectionSnackbar } from "../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadOverlay, FileUploadStatusBadge } from "../ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../ui/feedback/useFileSizeGuard";
import { useUploadCounter } from "../ui/feedback/useUploadCounter";
import { GifPicker } from "../ui/gif/GifPicker";
import { useBlockNoteDictionary } from "./blockNoteI18n";
import { insertEmojiValue } from "./CustomEmoji";
import { useGenosSchema } from "./genos/genosSchema";
import { GenosSuggestionMenus } from "./genos/GenosSuggestionMenus";
import { GenosChatToolbar } from "./genos/GenosToolbars";
import { useGenosEditor } from "./genos/useGenosEditor";
import { EditorSendButton } from "./sub/EditorSendButton";

// Chat attachment upload uses channelService.uploadInlineFile (v3); the
// legacy VITE_API_BASE_URL / VITE_DJANGO_URL upload consts were removed.

type BnChatEditorProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    chat: ChatProps;
    setCurrentChat: (chat: ChatProps) => void;
    useUISM: UIStateManagementState;
    numEditorLines: number;
    setNumEditorLines: (value: number) => void;
    pendingFiles?: File[];
    clearPendingFiles?: () => void;
};
export const BnChatEditor = (props: BnChatEditorProps) => {
    const {
        useTEM,
        useCM,
        myself,
        setMyself,
        socket,
        chat,
        setCurrentChat,
        useUISM,
        setNumEditorLines,
        pendingFiles,
        clearPendingFiles,
    } = props;
    const { mode } = useColorScheme();
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const isMobile = useIsMobile();
    const urlLinkModal = useUrlLinkModal();
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);
    // Session-only wrap toggles. See `WrapToggleButtons` for the two
    // CSS classes added to the outer Box when each is on.
    const [unwrapAll, setUnwrapAll] = useState<boolean>(false);
    const [unwrapCode, setUnwrapCode] = useState<boolean>(false);
    // The `with-subchat` modifier tightens the editor's max-height in
    // App.css when the split sub-chat pane is open, so the two stacked
    // editors don't collectively eat the message-list area.
    const bnBoxClassName: string = [
        `bn-chat-editor-box-${mode}`,
        useCM.isSubChatVisible && "with-subchat",
        unwrapAll && "bn-unwrap-all",
        unwrapCode && "bn-unwrap-code",
    ]
        .filter(Boolean)
        .join(" ");

    const teamMembersRef = useRef(useTEM.teamMembers);
    const teamMemberProfilesRef = useRef(useTEM.teamMemberProfiles);
    useEffect(() => {
        teamMembersRef.current = useTEM.teamMembers;
        teamMemberProfilesRef.current = useTEM.teamMemberProfiles;
    }, [useTEM.teamMembers, useTEM.teamMemberProfiles]);

    // Mention groups — sourced from the App-root provider so every
    // editor instance shares one fetch.
    const { mentionGroups } = useMentionGroupsContext();
    const mentionGroupsRef = useRef(mentionGroups);
    useEffect(() => {
        mentionGroupsRef.current = mentionGroups;
    }, [mentionGroups]);

    // The shared Genos schema (`genos/genosSchema.ts`), built once per mount:
    // `useCreateBlockNote` keeps the first schema it is given.
    const schema = useGenosSchema(
        {
            teamMemberProfiles: useTEM.teamMemberProfiles,
            socket,
            myself,
            setMyself,
            useUISM,
            useCM,
        },
        "mount"
    );

    // Counter wraps every `uploadFile` call so the small "Uploading n
    // files…" pill at the top of the editor reflects in-flight work
    // both for slash-menu / drag-into-editor inserts (BlockNote calls
    // `uploadFile` directly) and the `pendingFiles` loop below. Large
    // files routinely take several seconds and BlockNote's own in-block
    // placeholder isn't always obvious, so the pill plugs that gap.
    const { activeCount: editorUploadCount, wrap: trackUpload } = useUploadCounter();

    // Per-file size cap. `guardUploadFile` rejects oversize files
    // before any fetch happens (so BlockNote's slash-menu / drag
    // inserts and the `pendingFiles` loop both bail out cheaply) and
    // surfaces a friendly toast via the snackbar rendered below.
    const { rejection, dismissRejection, filterFiles, guardUploadFile } = useFileSizeGuard();

    const uploadFile = guardUploadFile(
        trackUpload(async (file: File) => {
            // v3: compose-time inline upload via the channel-scoped uploader.
            // The legacy `/chat/attachment/` route was removed in the v3
            // cutover; `uploadInlineFile` returns an absolute URL that
            // BlockNote embeds directly (no `django_url` host prepend).
            return channelService.uploadInlineFile(String(chat.chatId), file);
        })
    );

    const dictionary = useBlockNoteDictionary();
    const editor = useGenosEditor({ surface: "composer", schema, dictionary, uploadFile });

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
        editor.insertBlocks(
            [{ type: "image", props: { url: gif.url, name: gif.title } }],
            editor.getTextCursorPosition().block,
            "after"
        );
        setShowGifPicker(false);
    };
    useEffect(() => {
        if (selectedEmoji !== null) {
            insertEmoji(selectedEmoji);
        }
    }, [selectedEmoji]);

    // Tracks the chat-pane drop upload loop (separate from BlockNote's
    // own `uploadFile` placeholder) so the editor surface can show a
    // dim overlay with "Uploading 2 / 5 — large.pdf" text. Without this
    // the user sees nothing for several seconds while large files
    // POST in series, then the blocks suddenly appear.
    const [pendingUpload, setPendingUpload] = useState<{
        index: number;
        total: number;
        name: string;
    } | null>(null);

    // Upload files in series and insert each as an image/file block at
    // the end of the doc, driving the dim progress overlay. Shared by the
    // chat-pane drop loop and the mobile "attach image/file" toolbar
    // picker (both hand off a raw File[] the same way).
    const uploadAndInsertFiles = async (files: File[]) => {
        // Drop oversize files up-front so the dim overlay only counts
        // files we'll actually try to upload.
        const acceptedFiles = filterFiles(files);
        if (acceptedFiles.length === 0) return;
        try {
            for (let i = 0; i < acceptedFiles.length; i += 1) {
                const file = acceptedFiles[i];
                setPendingUpload({
                    index: i + 1,
                    total: acceptedFiles.length,
                    name: file.name,
                });
                try {
                    const url = await uploadFile(file);
                    const isImage = file.type.startsWith("image/");
                    editor.insertBlocks(
                        [
                            isImage
                                ? { type: "image", props: { url, name: file.name } }
                                : { type: "file", props: { url, name: file.name } },
                        ],
                        editor.document[editor.document.length - 1],
                        "after"
                    );
                } catch (err) {
                    console.error("Failed to insert file:", err);
                }
            }
        } finally {
            setPendingUpload(null);
        }
    };

    // Hidden native picker behind the mobile "attach" toolbar button. On
    // a phone BlockNote's drag-drop / side-menu insert paths aren't
    // reachable, so this is the only way to send an image/file.
    const attachInputRef = useRef<HTMLInputElement>(null);
    const onAttachInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        // Reset so picking the same file twice in a row re-fires change.
        event.target.value = "";
        if (files.length > 0) void uploadAndInsertFiles(files);
    };

    // Process files dropped on the chat pane (outside the editor)
    useEffect(() => {
        if (pendingFiles && pendingFiles.length > 0 && clearPendingFiles) {
            void uploadAndInsertFiles(pendingFiles).finally(() => clearPendingFiles());
        }
    }, [pendingFiles]);

    // Whether there is anything to send. A block count meant "typed something"
    // only while BlockNote kept a real empty block at the end (MIP-1039).
    const [canSend, setCanSend] = useState<boolean>(false);

    // Restore (or clear) the editor when the user navigates between
    // chats, and persist unsent typing as a per-chat draft. See
    // `useEditorDraft` for the load/save/clear lifecycle.
    const draftCacheKey =
        chat?.chatId != null && chat?.chatType != null
            ? `chat:${chat.chatType}:${chat.chatId}`
            : null;
    const { saveDraft, clearDraft } = useEditorDraft(editor, draftCacheKey);

    // While a dropped/pasted image or file is still uploading, BlockNote
    // has already inserted its block (so the composer looks non-empty and
    // the Send button would light up) but the block's `url` is still empty
    // — sending now ships an empty/broken attachment. Hold send until every
    // in-flight upload settles: `editorUploadCount` covers BlockNote's own
    // drop/paste/slash inserts (they call the wrapped `uploadFile`), and
    // `pendingUpload` covers the chat-pane drop loop.
    const uploadInProgress = editorUploadCount > 0 || pendingUpload !== null;

    const sendingMessage = async () => {
        if (hasSendableContent(editor.document) && socket !== null && !uploadInProgress) {
            // Capture the message, then clear the composer IMMEDIATELY —
            // don't freeze it on the server round-trip. The previous
            // `await sendChatMessage(...)` BEFORE clearing held the editor
            // full for the entire ack latency (up to the backend's 10s
            // Django read-timeout); the send now runs in the background.
            const content = editor.document;
            editor.replaceBlocks(editor.document, []);
            clearDraft();
            const sent = await sendChatMessage({
                socket,
                chat,
                content: withTrailingBlank(content),
                myself,
                useCM,
                setCurrentChat,
            });
            // On failure (sendChatMessage has already surfaced a toast),
            // put the text back so it isn't lost — but only if the user
            // hasn't started a new message meanwhile. Re-insert a JSON
            // deep-clone, NOT the live block objects we just removed: that
            // mirrors exactly how useEditorDraft restores a draft from
            // storage (deserialized blocks), the path BlockNote re-hydrates
            // cleanly on every chat switch, so there's no id-reuse rejection.
            if (!sent && !hasSendableContent(editor.document)) {
                try {
                    editor.replaceBlocks(editor.document, JSON.parse(JSON.stringify(content)));
                } catch {
                    /* stale block shape — nothing else we can do */
                }
            }
        }
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

    return (
        <Box>
            <FileSizeRejectionSnackbar rejection={rejection} onDismiss={dismissRejection} />
            {/* Hidden native picker for the mobile "attach image/file"
                toolbar button. Rendered unconditionally; only the button
                that clicks it is mobile-gated. */}
            <input
                ref={attachInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={onAttachInputChange}
            />
            {/* Anchored so the picker's bottom edge sits right on the
                editor's top edge (the zero-height wrapper renders directly
                above the editor box) instead of floating over the list. */}
            <EmojiPicker
                pickerBottomPosition={4}
                pickerLeftPosition={8}
                setSelectedEmoji={setSelectedEmoji}
                setShowEmojiPicker={setShowEmojiPicker}
                showEmojiPicker={showEmojiPicker}
            />
            <GifPicker
                pickerBottomPosition={4}
                pickerLeftPosition={8}
                setShowGifPicker={setShowGifPicker}
                showGifPicker={showGifPicker}
                onSelect={insertGif}
            />
            <Box ref={editorBoxRef} className={bnBoxClassName} sx={{ position: "relative" }}>
                <FileUploadStatusBadge count={editorUploadCount} />
                <FileUploadOverlay
                    label={t.common.ui.fileUpload.uploadingDroppedFiles}
                    open={pendingUpload !== null}
                    detail={
                        pendingUpload
                            ? `${pendingUpload.name} (${pendingUpload.index} / ${pendingUpload.total})`
                            : undefined
                    }
                />
                <BlockNoteView
                    className="bn-box"
                    editor={editor}
                    emojiPicker={false}
                    // A custom "/" SuggestionMenuController is mounted below —
                    // the built-in menu must be off or BOTH render on "/",
                    // stacking duplicate group labels (the "Media x3" bug).
                    slashMenu={false}
                    formattingToolbar={false}
                    sideMenu={false} // false for Chat/comment, true for Task content
                    theme={mode === "dark" ? "dark" : "light"}
                    data-changing-font-demo // custom font
                    onChange={() => {
                        const comments: any[] = editor.document;
                        setNumEditorLines(countLines(comments));
                        setCanSend(hasSendableContent(editor.document));
                        saveDraft(editor.document);
                    }}
                    onKeyDown={async (event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            sendingMessage();
                        }
                    }}
                >
                    <EditorSendButton
                        disabled={!canSend || uploadInProgress}
                        onSend={() => {
                            void sendingMessage();
                        }}
                    />

                    <Box
                        className="bn-editor-toolbar"
                        sx={{
                            position: "absolute",
                            // `top: "1%"` resolved against the editor box, so
                            // on a phone the bar started ~3px down and its
                            // ~47px height ran past the content's 40px
                            // `padding-top` — covering the first line you
                            // typed. Flush to the top on mobile, with a
                            // tighter inner pad so the bar is shorter than
                            // the padding that clears it (see App.css).
                            top: { xs: 0, md: "1%" },
                            left: { xs: 0, md: "0.5%" },
                            zIndex: 1,
                            p: { xs: 0.25, md: 0.7 },
                        }}
                    >
                        <GenosChatToolbar
                            editor={editor}
                            isMobile={isMobile}
                            setShowEmojiPicker={setShowEmojiPicker}
                            setShowGifPicker={setShowGifPicker}
                            onAttach={() => attachInputRef.current?.click()}
                            wrapToggles={{ unwrapAll, setUnwrapAll, unwrapCode, setUnwrapCode }}
                        />
                    </Box>

                    <GenosSuggestionMenus
                        editor={editor}
                        getMentionSources={() => ({
                            teamMemberProfiles: teamMemberProfilesRef.current,
                            teamMembers: teamMembersRef.current,
                            myselfUserId: myself.userId,
                            mentionGroups: mentionGroupsRef.current,
                        })}
                        slash={{ preset: "chat", setShowGifPicker }}
                    />
                </BlockNoteView>
            </Box>
        </Box>
    );
};
