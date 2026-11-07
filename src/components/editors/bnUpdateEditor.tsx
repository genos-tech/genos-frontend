import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useEffect, useRef, useState } from "react";
import { filterSuggestionItems } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
    BasicTextStyleButton,
    BlockTypeSelect,
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
    getDefaultReactSlashMenuItems,
    SuggestionMenuController,
    useCreateBlockNote,
} from "@blocknote/react";
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
import { resolveInsecureFileUrl } from "../../utils/downloadUtils";
import { filterAndRankSuggestionItems } from "../../utils/suggestionRanking";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
import { FileSizeRejectionSnackbar } from "../ui/feedback/FileSizeRejectionSnackbar";
import { FileUploadStatusBadge } from "../ui/feedback/FileUploadProgress";
import { useFileSizeGuard } from "../ui/feedback/useFileSizeGuard";
import { useUploadCounter } from "../ui/feedback/useUploadCounter";
import { GifPicker } from "../ui/gif/GifPicker";
import { useBlockNoteDictionary } from "./blockNoteI18n";
import { insertEmojiValue } from "./CustomEmoji";
import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { getEmojiSuggestionItems } from "./EmojiSuggestion";
import { useGenosSchema } from "./genos/genosSchema";
import { GifToolbarButton, withGifSlashItem } from "./GifToolbarButton";
import { HashSuggestionMenuController } from "./HashMention";
import { MentionMenuItems, MentionSuggestionMenu } from "./Mention";
import { codeFenceInputRule, getBlockTypeSelectItemsWithCodeBlock } from "./sub/codeBlockExtras";
import { linkHostCaption } from "./sub/linkHostCaption";
import { TAB_INDENT_OPTIONS } from "./sub/tabIndent";

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

    // See `bnChatEditor` for the rationale on `useUploadCounter`.
    const { activeCount: editorUploadCount, wrap: trackUpload } = useUploadCounter();

    // Per-file size cap. See `bnChatEditor` for the rationale.
    const { rejection, dismissRejection, guardUploadFile } = useFileSizeGuard();

    const uploadFile = guardUploadFile(
        trackUpload(async (file: File) => {
            // v3: compose-time inline upload via the channel-scoped uploader
            // (returns an absolute URL; no `django_url` prepend). Replaces
            // the deleted `/chat/attachment/` route.
            return channelService.uploadInlineFile(String(chat.chatId), file);
        })
    );

    // List containing all default Slash Menu Items, as well as our custom one.
    const getCustomSlashMenuItems = (
        editor: typeof schema.BlockNoteEditor
    ): DefaultReactSuggestionItem[] =>
        withGifSlashItem(getDefaultReactSlashMenuItems(editor), setShowGifPicker);

    const dictionary = useBlockNoteDictionary();
    // Without the stored trailing blank line, or editing shows (and saves) an
    // extra empty line at the end (MIP-1039).
    const initialContent: any[] = withoutTrailingBlank(message.content);
    const editor = useCreateBlockNote({
        ...TAB_INDENT_OPTIONS,
        schema,
        resolveFileUrl: resolveInsecureFileUrl,
        uploadFile,
        // `codeFenceInputRule`: a ``` fence (+ Space or Enter) always makes a code
        // block with a language that exists (see codeBlockExtras.tsx).
        extensions: [codeFenceInputRule, linkHostCaption],
        dictionary,
        initialContent: initialContent,
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

    const [canSend, setCanSend] = useState<boolean>(hasSendableContent(message.content));

    useEffect(() => {
        if (isInEdit === false) {
            editor.replaceBlocks(editor.document, []);
        }
    }, [isInEdit]);

    useEffect(() => {
        const newInitialContent: any[] = withoutTrailingBlank(message.content);
        editor.replaceBlocks(editor.document, newInitialContent);
    }, [message]);

    const sendUpdatedMessage = async () => {
        if (!hasSendableContent(editor.document)) return;
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
                withTrailingBlank(editor.document),
                getFirstLine(editor.document[0])
            );
        } catch (e) {
            console.error("[bnUpdateEditor] channelService.edit failed:", e);
            notifyActionError(e);
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
                    }}
                    onKeyDown={async (event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            sendUpdatedMessage();
                            setIsInEdit(false);
                        }
                    }}
                >
                    <IconButton
                        color="success"
                        disabled={!canSend}
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
                            sendUpdatedMessage();
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
                        <FormattingToolbar>
                            <BlockTypeSelect
                                key={"blockTypeSelect"}
                                items={getBlockTypeSelectItemsWithCodeBlock(editor)}
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
                            {/* Extra button to toggle code styles */}
                            <BasicTextStyleButton
                                key={"codeStyleButton"}
                                basicTextStyle={"code"}
                            />

                            <ColorStyleButton key={"colorStyleButton"} />
                            {!isMobile && <CreateLinkButton key={"createLinkButton"} />}
                            <FileCaptionButton key={"fileCaptionButton"} />
                            <FileReplaceButton key={"replaceFileButton"} />
                            <FileDeleteButton key={"fileDeleteButton"} />
                            <FileDownloadButton key={"fileDownloadButton"} />
                            <FilePreviewButton key={"filePreviewButton"} />
                            <FileRenameButton key={"fileRenameButton"} />

                            {/* Extra button to toggle blue text & background */}
                            {!isMobile && (
                                <CustomEmojiToolbar
                                    key={"customButton"}
                                    setShowEmojiPicker={setShowEmojiPicker}
                                />
                            )}
                            {!isMobile && (
                                <GifToolbarButton
                                    key={"gifButton"}
                                    setShowGifPicker={setShowGifPicker}
                                />
                            )}
                        </FormattingToolbar>
                    </Box>

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
                        // Replaces the default Slash Menu items with our custom ones.
                        getItems={async (query) =>
                            filterSuggestionItems(getCustomSlashMenuItems(editor), query)
                        }
                    />
                    <SuggestionMenuController
                        getItems={async (query) => getEmojiSuggestionItems(editor, query)}
                        minQueryLength={2}
                        triggerCharacter={":"}
                    />
                </BlockNoteView>
            </Box>
        </Box>
    );
};
