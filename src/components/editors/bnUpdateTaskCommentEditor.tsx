import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "../../App.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultBlockSpecs, filterSuggestionItems } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
    BasicTextStyleButton,
    BlockTypeSelect,
    ColorStyleButton,
    CreateLinkButton,
    DefaultReactSuggestionItem,
    FileCaptionButton,
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

import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { emitTaskTouched } from "../../features/tasks/services/taskEvents";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskCommentProps } from "../../types/tasks";
import { resolveInsecureFileUrl } from "../../utils/downloadUtils";
import { filterAndRankSuggestionItems } from "../../utils/suggestionRanking";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
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

type BnUpdateTaskCommentEditorProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    projectId?: number;
    projectName?: string;
    taskId?: number;
    // Human-readable parent task id ("<code>-<n>") forwarded on the
    // outgoing `task_comment` PUT so the backend's derived activity
    // payload can stamp it onto the chat-activity-sidebar entry. Without
    // this the activity item for a comment edit falls back to "#<taskId>".
    taskDisplayId?: string | null;
    isPrivate?: boolean;
    setTaskUpdated?: (value: boolean) => void;
    targetComment: TaskCommentProps;
    isInEdit: boolean;
    setIsInEdit: (value: boolean) => void;
    useUISM: UIStateManagementState;
    taskCommentLines: number;
    setTaskCommentLines: (value: number) => void;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
};

export const BnUpdateTaskCommentEditor = (props: BnUpdateTaskCommentEditorProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        projectId,
        projectName,
        isPrivate,
        taskId,
        taskDisplayId,
        setTaskUpdated,
        targetComment,
        isInEdit,
        setIsInEdit,
        taskCommentLines,
        setTaskCommentLines,
        useUISM,
        useCM,
        useTM,
    } = props;
    const { mode } = useColorScheme();
    const isMobile = useIsMobile();
    const urlLinkModal = useUrlLinkModal();
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);
    const bnBoxClassName: string = `bn-task-comment-box-${mode}`;

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

    // List containing all default Slash Menu Items, as well as our custom one.
    const getCustomSlashMenuItems = (
        editor: typeof schema.BlockNoteEditor
    ): DefaultReactSuggestionItem[] =>
        withGifSlashItem(getDefaultReactSlashMenuItems(editor), setShowGifPicker);

    const dictionary = useBlockNoteDictionary();
    // Without the stored trailing blank line (MIP-1039; see bnUpdateEditor).
    const initialContent: any[] = withoutTrailingBlank(targetComment.commentBody);
    const editor = useCreateBlockNote({
        ...TAB_INDENT_OPTIONS,
        schema,
        resolveFileUrl: resolveInsecureFileUrl,
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

    const countLines = (nodes: any[]): number => {
        let count = 0;
        for (const node of nodes) {
            count += 1; // count the current node itself
            if (node.children?.length) {
                count += countLines(node.children); // recursive call
            }
            // Guarded: image/file blocks carry no `content` array.
            if (node.content && node.content[0]) {
                if (node.content[0].text) {
                    count += node.content[0].text.split("\n").length;
                }
            }
            // Add lines for each image to avoid scroll issues (same
            // heuristic as BnChatEditor).
            if (node.type === "image") {
                count += 10;
            }
        }
        return count;
    };

    const [canSend, setCanSend] = useState<boolean>(hasSendableContent(targetComment.commentBody));
    const [numEditorLines, setNumEditorLines] = useState<number>(0);

    // Mirror the local line count back up to the task page. Editor
    // height is now controlled by App.css min/max-height bounds.
    useEffect(() => {
        if (numEditorLines !== taskCommentLines) {
            setTaskCommentLines(numEditorLines);
        }
    }, [numEditorLines]);

    // Initial num of lines
    useEffect(() => {
        const comments: any[] = editor.document;
        setNumEditorLines(countLines(comments));
    }, []);

    useEffect(() => {
        if (selectedEmoji !== null) {
            insertEmoji(selectedEmoji);
        }
    }, [selectedEmoji]);

    useEffect(() => {
        if (isInEdit === false) {
            editor.replaceBlocks(editor.document, []);
        }
    }, [isInEdit, taskId]);

    const updateComment = async () => {
        if (socket) {
            if (hasSendableContent(editor.document)) {
                socket.emit(
                    "task_comment",
                    {
                        method_type: "PUT",
                        project_id: projectId,
                        project_name: projectName,
                        task_id: taskId,
                        // Mirrors the POST-side emit in bnTaskCommentEditor so the
                        // derived activity broadcast carries the friendly task id.
                        display_id: taskDisplayId,
                        comment_id: targetComment.commentId,
                        comment_body: withTrailingBlank(editor.document),
                        is_private: isPrivate || false,
                    },
                    (ack: any) => {
                        useTM.setIsTaskCommentUpdated({ isUpdate: true, scrollToBottom: true });
                        emitTaskTouched(Number(taskId), "comment");
                    }
                );
            }
        }
    };

    const boxRef = useRef<HTMLDivElement>(null);
    // Picker is rendered via portal into document.body with position:fixed so it
    // can never be clipped by an overflow:hidden ancestor and always stacks on top.
    // We anchor its viewport coordinates so it sits directly ABOVE the comment
    // editor box, with safe-area clamping to keep it inside the window.
    const PICKER_WIDTH = 360;
    const PICKER_HEIGHT = 440;
    const PICKER_MARGIN = 8;
    const [pickerTopPosition, setPickerTopPosition] = useState<number>(0);
    const [pickerLeftPosition, setPickerLeftPosition] = useState<number>(0);

    const updatePickerPosition = useCallback(() => {
        if (!boxRef.current) return;
        const rect = boxRef.current.getBoundingClientRect();
        const top = Math.max(PICKER_MARGIN, rect.top - PICKER_HEIGHT - PICKER_MARGIN);
        const maxLeft = Math.max(PICKER_MARGIN, window.innerWidth - PICKER_WIDTH - PICKER_MARGIN);
        const left = Math.min(Math.max(PICKER_MARGIN, rect.left), maxLeft);
        setPickerTopPosition(top);
        setPickerLeftPosition(left);
    }, []);

    useEffect(() => {
        if (!showEmojiPicker && !showGifPicker) return;
        updatePickerPosition();
        window.addEventListener("resize", updatePickerPosition);
        // Use capture so we catch scrolls inside any scrollable ancestor too.
        window.addEventListener("scroll", updatePickerPosition, true);
        return () => {
            window.removeEventListener("resize", updatePickerPosition);
            window.removeEventListener("scroll", updatePickerPosition, true);
        };
    }, [showEmojiPicker, showGifPicker, updatePickerPosition]);

    return (
        <Box ref={boxRef}>
            <EmojiPicker
                pickerBottomPosition="auto"
                pickerLeftPosition={pickerLeftPosition}
                pickerRightPosition="auto"
                pickerTopPosition={pickerTopPosition}
                setSelectedEmoji={setSelectedEmoji}
                setShowEmojiPicker={setShowEmojiPicker}
                showEmojiPicker={showEmojiPicker}
                useFixedPosition={true}
            />
            <GifPicker
                pickerBottomPosition="auto"
                pickerLeftPosition={pickerLeftPosition}
                pickerRightPosition="auto"
                pickerTopPosition={pickerTopPosition}
                setShowGifPicker={setShowGifPicker}
                showGifPicker={showGifPicker}
                useFixedPosition={true}
                onSelect={insertGif}
            />
            <Box ref={editorBoxRef} className={bnBoxClassName} sx={{ position: "relative" }}>
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
                    onBlur={() => {
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    }}
                    onChange={() => {
                        const comments: any[] = editor.document;
                        setNumEditorLines(countLines(comments));
                        setCanSend(hasSendableContent(editor.document));
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                            updateComment();
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
                        onClick={() => {
                            updateComment();
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

                            <FileCaptionButton key={"fileCaptionButton"} />
                            <FileReplaceButton key={"replaceFileButton"} />

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
