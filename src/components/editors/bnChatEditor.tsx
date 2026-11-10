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
import { sendChatMessage } from "../../features/chat/services/sendChatMessage";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
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

    const dictionary = useBlockNoteDictionary();

    // Upload pipeline, `pendingFiles` drop queue, draft, canSend and the send flow are the
    // shared composer hook's (see `composer/useChatComposer`). A chat message is emptied from
    // the composer BEFORE the server answers and put back if the send fails.
    const composer = useChatComposer({
        schema,
        dictionary,
        // v3: compose-time inline upload via the channel-scoped uploader.
        // The legacy `/chat/attachment/` route was removed in the v3
        // cutover; `uploadInlineFile` returns an absolute URL that
        // BlockNote embeds directly (no `django_url` host prepend).
        uploads: { channelId: String(chat.chatId) },
        // Files dropped on the chat pane (outside the editor).
        dropQueue: { files: pendingFiles, clear: clearPendingFiles },
        // Restore (or clear) the editor when the user navigates between
        // chats, and persist unsent typing as a per-chat draft.
        draftKey:
            chat?.chatId != null && chat?.chatType != null
                ? `chat:${chat.chatType}:${chat.chatId}`
                : null,
        onLinesChange: setNumEditorLines,
        canSubmit: () => socket !== null,
        // `sendChatMessage` has already surfaced a toast when it returns false.
        submit: (content) =>
            sendChatMessage({
                socket: socket!,
                chat,
                content: withTrailingBlank(content),
                myself,
                useCM,
                setCurrentChat,
            }),
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
            {/* data-fab-avoid: the floating "Open Genos" button rises above this box
                instead of covering Send (MIP-1403). */}
            <Box
                ref={editorBoxRef}
                className={bnBoxClassName}
                data-fab-avoid="composer"
                sx={{ position: "relative" }}
            >
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
                    <EditorSendButton
                        disabled={composer.sendDisabled}
                        onSend={() => {
                            void composer.send();
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
                            mentionGroups: mentionGroupsRef.current,
                        })}
                        slash={{ preset: "chat", setShowGifPicker }}
                    />
                </BlockNoteView>
            </Box>
        </Box>
    );
};
