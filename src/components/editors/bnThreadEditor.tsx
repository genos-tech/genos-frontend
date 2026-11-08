import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useEffect, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { withTrailingBlank } from "./utils/messageBlocks";

import { useAuth } from "../../context/AuthContext";
import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { getFirstLine } from "../../features/chat/utils/common";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { channelService } from "../../services/channel/channelService";
import { emitRequestError } from "../../services/requestErrorNotifier";
import { UserProps } from "../../types/admin";
import { ChatProps, ThreadProps } from "../../types/chat";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
import { FileSizeRejectionSnackbar } from "../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadOverlay, FileUploadStatusBadge } from "../ui/feedback/FileUploadProgress";
import { GifPicker } from "../ui/gif/GifPicker";
import { useBlockNoteDictionary } from "./blockNoteI18n";
import { useChatComposer } from "./composer/useChatComposer";
import { insertEmojiValue } from "./CustomEmoji";
import { useGenosSchema } from "./genos/genosSchema";
import { GenosSuggestionMenus } from "./genos/GenosSuggestionMenus";
import { GenosChatToolbar } from "./genos/GenosToolbars";
import { EditorSendButton } from "./sub/EditorSendButton";

// Chat attachment upload uses channelService.uploadInlineFile (v3); the
// legacy VITE_API_BASE_URL / VITE_DJANGO_URL upload consts were removed.

type BnThreadEditorProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    thread: ThreadProps;
    setCurrentThreadChat: (chat: ThreadProps) => void;
    setCurrentChat: (chat: ChatProps) => void;
    useUISM: UIStateManagementState;
    numEditorLines: number;
    setNumEditorLines: (value: number) => void;
    useCM: ChatManagementState;
    pendingFiles?: File[];
    clearPendingFiles?: () => void;
};
export const BnThreadEditor = (props: BnThreadEditorProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        thread,
        setCurrentThreadChat,
        setCurrentChat,
        useUISM,
        setNumEditorLines,
        useCM,
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
    const bnBoxClassName: string = [
        `bn-chat-editor-box-${mode}`,
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

    const { mentionGroups } = useMentionGroupsContext();

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

    const dictionary = useBlockNoteDictionary();

    // Upload pipeline, `pendingFiles` drop queue, draft, canSend and the send flow are the
    // shared composer hook's (see `composer/useChatComposer`). A reply is emptied from the
    // composer BEFORE the server answers and put back if the send fails.
    const composer = useChatComposer({
        schema,
        dictionary,
        // v3: compose-time inline upload via the channel-scoped uploader
        // (returns an absolute URL; no `django_url` prepend). Replaces
        // the deleted `/chat/attachment/` route.
        uploads: { channelId: String(thread.chatId) },
        // Files dropped on the thread pane (outside the editor).
        dropQueue: { files: pendingFiles, clear: clearPendingFiles, mode: "after" },
        // Per-thread draft cache. Keyed by chatType + chatId + threadId so each thread keeps
        // its own in-progress reply separate from the parent chat's main-channel draft.
        draftKey:
            thread?.chatType != null && thread?.chatId != null && thread?.threadId != null
                ? `thread:${thread.chatType}:${thread.chatId}:${thread.threadId}`
                : null,
        onLinesChange: setNumEditorLines,
        submit: async (content) => {
            // v3 cutover. The legacy `socket.emit("thread_message", POST,
            // ...)` + manual optimistic append + addThreadMessage IDB
            // write is replaced by `channelService.send(channelUuid,
            // body, {parentId: threadRootUuid, bodyText})`. The v3 backend:
            //
            //   1. Persists a `Message` row with `is_thread_reply=true`
            //      and `parent_id = threadRootUuid`.
            //   2. Increments the parent's `reply_count` atomically.
            //   3. Broadcasts `message.created` to the channel room.
            //
            // channelService.handleMessageCreated upserts the row into the
            // channel's `messagesByChannel` slice; the thread-pane
            // subscription in `useChatManagement` picks it up and patches
            // `currentThreadChat.messages` automatically. No optimistic
            // local state needed here.
            const bodyText: string = getFirstLine(content[0]);
            const channelUuid = String(thread.chatId);
            const threadRootUuid = String(thread.threadId);
            try {
                // `echo`: optimistic local row so the reply renders in the
                // thread pane immediately instead of after the server ack
                // round-trip. channelService swaps it for the server row on
                // ack and removes it on failure (the restore then
                // puts the text back in the composer).
                await channelService.send(channelUuid, withTrailingBlank(content), {
                    parentId: threadRootUuid,
                    bodyText,
                    echo: {
                        sender: {
                            avatarImgPath: myself.avatarImgPath || null,
                            isSystemUser: false,
                            userEmail: myself.userEmail,
                            userId: myself.userId,
                            userName: myself.userName,
                        },
                    },
                });
                return true;
            } catch (e) {
                console.error("[bnThreadEditor] channelService.send failed:", e);
                emitRequestError("messageSendFailed");
                return false;
            }
        },
    });
    const { editor } = composer;

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

    return (
        <Box>
            <FileSizeRejectionSnackbar
                rejection={composer.rejection}
                onDismiss={composer.dismissRejection}
            />
            {/* Hidden native picker for the mobile "attach image/file"
                toolbar button. Rendered unconditionally; only the button
                that clicks it is mobile-gated. */}
            <input
                ref={composer.attachInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={composer.onAttachInputChange}
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
                <FileUploadStatusBadge count={composer.editorUploadCount} />
                <FileUploadOverlay
                    label={t.common.ui.fileUpload.uploadingDroppedFiles}
                    open={composer.overlay.open}
                    detail={composer.overlay.detail}
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
                    onChange={composer.viewProps.onChange}
                    onKeyDown={composer.viewProps.onKeyDown}
                >
                    <EditorSendButton disabled={composer.sendDisabled} onSend={composer.send} />

                    <Box
                        className="bn-editor-toolbar"
                        sx={{
                            position: "absolute",
                            top: "1%",
                            left: "0.5%",
                            zIndex: 1,
                            p: 0.7,
                        }}
                    >
                        <GenosChatToolbar
                            editor={editor}
                            isMobile={isMobile}
                            setShowEmojiPicker={setShowEmojiPicker}
                            setShowGifPicker={setShowGifPicker}
                            onAttach={composer.openAttach}
                            wrapToggles={{ unwrapAll, setUnwrapAll, unwrapCode, setUnwrapCode }}
                        />
                    </Box>

                    <GenosSuggestionMenus
                        editor={editor}
                        getMentionSources={() => ({
                            teamMemberProfiles: teamMemberProfilesRef.current,
                            teamMembers: teamMembersRef.current,
                            myselfUserId: myself.userId,
                            mentionGroups,
                        })}
                        slash={{ preset: "chat", setShowGifPicker }}
                    />
                </BlockNoteView>
            </Box>
        </Box>
    );
};
