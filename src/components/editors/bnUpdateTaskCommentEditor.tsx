import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "../../App.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { codeBlockOptions } from "@blocknote/code-block";
import {
    BlockNoteSchema,
    createCodeBlockSpec,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
    filterSuggestionItems,
} from "@blocknote/core";
import { en } from "@blocknote/core/locales";
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

import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskCommentProps } from "../../types/tasks";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { getEmojiSuggestionItems } from "./EmojiSuggestion";
import {
    CreateMentionGroupSpec,
    CreateMentionSpec,
    MentionMenuItems,
    MentionSuggestionMenu,
} from "./Mention";
import {
    codeBlockEnterShortcut,
    getBlockTypeSelectItemsWithCodeBlock,
} from "./sub/codeBlockExtras";

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
    taskComments: TaskCommentProps[];
    setTaskComments: (value: TaskCommentProps[]) => void;
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
        taskComments,
        setTaskComments,
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

    // Disable the Audio and Image blocks from the built-in schema
    // This is done by picking out the blocks you want to disable
    const { audio, image, video, file, ...remainingBlockSpecs } = defaultBlockSpecs;

    const { mentionGroups } = useMentionGroupsContext();

    // Our schema with inline content specs, which contain the configs and
    // implementations for inline content  that we want our editor to use.
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
            // remainingBlockSpecs contains all the other blocks
            ...remainingBlockSpecs,
            // BlockNote 0.49 moved the code-block options out of
            // `useCreateBlockNote` and into the schema. We override
            // the default plain-text codeBlock with the syntax-
            // highlighted one shipped by `@blocknote/code-block`.
            codeBlock: createCodeBlockSpec(codeBlockOptions),
        },
    });

    // List containing all default Slash Menu Items, as well as our custom one.
    const getCustomSlashMenuItems = (
        editor: typeof schema.BlockNoteEditor
    ): DefaultReactSuggestionItem[] => getDefaultReactSlashMenuItems(editor);

    // We use the English, default dictionary
    const locale = en;
    const initialContent: any[] = targetComment.commentBody;
    const editor = useCreateBlockNote({
        schema,
        // `codeBlockEnterShortcut` augments the built-in
        // ``` + Space input rule with an Enter-key handler, so
        // users get the same Markdown shortcut they expect.
        extensions: [codeBlockEnterShortcut],
        // We override the `placeholders` in our dictionary
        dictionary: {
            ...locale,
            placeholders: {
                ...locale.placeholders,
                // We override the empty document placeholder
                emptyDocument: "Start typing...",
                // We override the default placeholder
                default: "Type something...",
                // We override the heading placeholder
                heading: "Custom heading placeholder",
            },
        },
        initialContent: initialContent,
    });

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
            if (node.content[0]) {
                if (node.content[0].text) {
                    count += node.content[0].text.split("\n").length;
                }
            }
        }
        return count;
    };

    const [editorDocLength, setEditorDocLength] = useState<number>(0);
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
        if (useTM.isTaskCommentUpdated && useTM.isTaskCommentUpdated.isUpdate === true && taskId) {
            setTaskComments([
                ...taskComments,
                {
                    projectId: projectId || null,
                    taskId: taskId,
                    senderId: myself.userId,
                    senderName: myself.userName,
                    commentId: taskComments.length + 1,
                    commentBody: editor.document,
                    tsSent: getLocalCurrentTimestamp(),
                    tsUpdated: getLocalCurrentTimestamp(),
                    isEdited: false,
                },
            ]);
            editor.replaceBlocks(editor.document, []);
            useTM.setIsTaskCommentUpdated({ isUpdate: false, scrollToBottom: false });
        }
    }, [useTM.isTaskCommentUpdated, taskComments]);

    useEffect(() => {
        if (isInEdit === false) {
            editor.replaceBlocks(editor.document, []);
        }
    }, [isInEdit, taskId]);

    const updateComment = async () => {
        if (socket) {
            if (editor.document.length > 1) {
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
                        comment_body: editor.document,
                        is_private: isPrivate || false,
                    },
                    (ack: any) => {
                        useTM.setIsTaskCommentUpdated({ isUpdate: true, scrollToBottom: true });
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
        if (!showEmojiPicker) return;
        updatePickerPosition();
        window.addEventListener("resize", updatePickerPosition);
        // Use capture so we catch scrolls inside any scrollable ancestor too.
        window.addEventListener("scroll", updatePickerPosition, true);
        return () => {
            window.removeEventListener("resize", updatePickerPosition);
            window.removeEventListener("scroll", updatePickerPosition, true);
        };
    }, [showEmojiPicker, updatePickerPosition]);

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
            <Box ref={editorBoxRef} className={bnBoxClassName} sx={{ position: "relative" }}>
                <BlockNoteView
                    className="bn-box"
                    editor={editor}
                    emojiPicker={false}
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
                        setEditorDocLength(editor.document.length);
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
                        disabled={editorDocLength < 2}
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
                                items={getBlockTypeSelectItemsWithCodeBlock(editor.dictionary)}
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
                        </FormattingToolbar>
                    </Box>

                    {/* Adds a mentions menu which opens with the "@" key */}
                    <SuggestionMenuController
                        suggestionMenuComponent={MentionSuggestionMenu}
                        triggerCharacter={"@"}
                        getItems={async (query) =>
                            // Gets the mentions menu items
                            filterSuggestionItems(
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
