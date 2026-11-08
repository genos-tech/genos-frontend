import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useEffect, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { Box, IconButton } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import {
    hasSendableContent,
    withoutTrailingBlank,
    withTrailingBlank,
} from "./utils/messageBlocks";

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
import { notifyActionError } from "../../services/requestErrorNotifier";
import { UserProps } from "../../types/admin";
import { ChatProps, MessageProps } from "../../types/chat";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
import { FileSizeRejectionSnackbar } from "../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadStatusBadge } from "../ui/feedback/FileUploadProgress";
import { GifPicker } from "../ui/gif/GifPicker";
import { useBlockNoteDictionary } from "./blockNoteI18n";
import { isSendShortcut, useChatComposer } from "./composer/useChatComposer";
import { insertEmojiValue } from "./CustomEmoji";
import { useGenosSchema } from "./genos/genosSchema";
import { GenosSuggestionMenus } from "./genos/GenosSuggestionMenus";
import { GenosChatToolbar } from "./genos/GenosToolbars";

// Chat attachment upload uses channelService.uploadInlineFile (v3); the
// legacy VITE_API_BASE_URL / VITE_DJANGO_URL upload consts were removed.

type BnUpdateEditorProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    chat: ChatProps;
    message: MessageProps;
    isInEdit: boolean;
    setIsInEdit: (value: boolean) => void;
    useUISM: UIStateManagementState;
    numEditorLines: number;
    setNumEditorLines: (value: number) => void;
    useCM: ChatManagementState;
};
export const BnUpdateEditor = (props: BnUpdateEditorProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        chat,
        message,
        isInEdit,
        setIsInEdit,
        useUISM,
        setNumEditorLines,
        useCM,
    } = props;
    const { mode } = useColorScheme();
    const isMobile = useIsMobile();
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const urlLinkModal = useUrlLinkModal();
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);
    const bnBoxClassName: string = `bn-chat-editor-box-${mode}${
        useCM.isSubChatVisible ? " with-subchat" : ""
    }`;

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
    // Without the stored trailing blank line, or editing shows (and saves) an
    // extra empty line at the end (MIP-1039).
    const initialContent: any[] = withoutTrailingBlank(message.content);

    // Edit in place: the shared composer pipeline with no draft and no send gate on uploads
    // (`holdWhileUploading: false`, as before), and the host closes the editor itself.
    const composer = useChatComposer({
        schema,
        dictionary,
        initialContent,
        uploads: { channelId: String(chat.chatId) },
        initialCanSend: hasSendableContent(message.content),
        onLinesChange: setNumEditorLines,
        holdWhileUploading: false,
        clear: "never",
        submit: async (blocks) => {
            // v3 channelService.edit replaces the legacy
            // `socket.emit("message", {methodType: "PUT"})`. The v3 emit
            // acks back the canonical Message and broadcasts
            // `message.updated` on the channel room — the open chat's
            // live-update subscription picks up the new body on its own.
            // PM-specific (`taskId`, `taskStatus`) and routing fields
            // (`dmPartnerUserId`, `isPrivate`) aren't read by the v3 edit
            // path; the message's `metadata` JSON already carries them.
            const v3MessageId = message.messageIdWithChatId;
            if (!v3MessageId) {
                return;
            }
            try {
                await channelService.edit(
                    v3MessageId,
                    // Stored with the trailing blank line every reader expects (MIP-1039).
                    withTrailingBlank(blocks),
                    getFirstLine(blocks[0])
                );
            } catch (e) {
                console.error("[bnUpdateEditor] channelService.edit failed:", e);
                notifyActionError(e);
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

    useEffect(() => {
        if (isInEdit === false) {
            editor.replaceBlocks(editor.document, []);
        }
    }, [isInEdit]);

    useEffect(() => {
        const newInitialContent: any[] = withoutTrailingBlank(message.content);
        editor.replaceBlocks(editor.document, newInitialContent);
    }, [message]);

    return (
        <Box>
            <FileSizeRejectionSnackbar
                rejection={composer.rejection}
                onDismiss={composer.dismissRejection}
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
                    onKeyDown={(event) => {
                        if (isSendShortcut(event)) {
                            void composer.send();
                            setIsInEdit(false);
                        }
                    }}
                >
                    <IconButton
                        color="success"
                        disabled={composer.sendDisabled}
                        size="sm"
                        variant="solid"
                        sx={{
                            position: "absolute",
                            bottom: "5%",
                            right: "75px",
                            zIndex: 1,
                            p: 0.7,
                        }}
                        onClick={async () => {
                            composer.send();
                            setIsInEdit(false);
                        }}
                    >
                        Save
                    </IconButton>

                    <IconButton
                        color="danger"
                        size="sm"
                        variant="outlined"
                        sx={{
                            position: "absolute",
                            bottom: "5%",
                            right: "10px",
                            zIndex: 1,
                            p: 0.7,
                        }}
                        onClick={async () => setIsInEdit(false)}
                    >
                        Cancel
                    </IconButton>

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
                        />
                    </Box>

                    <GenosSuggestionMenus
                        editor={editor}
                        getMentionSources={() => ({
                            teamMemberProfiles: useTEM.teamMemberProfiles,
                            teamMembers: useTEM.teamMembers,
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
