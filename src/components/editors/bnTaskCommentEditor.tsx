import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "../../App.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { codeBlockOptions } from "@blocknote/code-block";
import {
    BlockNoteSchema,
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
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { taskThreadMessageForCommentAddedTemplate } from "../../features/tasks/utils/TaskMessageTemplate";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { TaskManagementState } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskCommentProps, TaskProps } from "../../types/tasks";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { EmojiPicker } from "../ui/emoji/EmojiPicker";
import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { getEmojiSuggestionItems } from "./EmojiSuggestion";
import { CreateMentionSpec, MentionMenuItems } from "./Mention";
import { EditorSendButton } from "./sub/EditorSendButton";

type BnTaskCommentEditorProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    task: TaskProps;
    setTaskUpdated?: (value: boolean) => void;
    taskComments: TaskCommentProps[];
    setTaskComments: (value: TaskCommentProps[]) => void;
    useUISM: UIStateManagementState;
    taskCommentLines: number;
    setTaskCommentLines: (value: number) => void;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
};

export const BnTaskCommentEditor = (props: BnTaskCommentEditorProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        task,
        setTaskUpdated,
        taskComments,
        setTaskComments,
        useUISM,
        taskCommentLines,
        setTaskCommentLines,
        useCM,
        useTM,
    } = props;
    const { mode } = useColorScheme();
    const bnBoxClassName: string = `bn-task-comment-box-${mode}`;

    // Disable the Audio and Image blocks from the built-in schema
    // This is done by picking out the blocks you want to disable
    const { audio, image, video, file, ...remainingBlockSpecs } = defaultBlockSpecs;

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
        },
        blockSpecs: {
            // remainingBlockSpecs contains all the other blocks
            ...remainingBlockSpecs,
        },
    });

    // List containing all default Slash Menu Items, as well as our custom one.
    const getCustomSlashMenuItems = (
        editor: typeof schema.BlockNoteEditor
    ): DefaultReactSuggestionItem[] => getDefaultReactSlashMenuItems(editor);

    // We use the English, default dictionary
    const locale = en;

    const editor = useCreateBlockNote({
        schema,
        codeBlock: codeBlockOptions,
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
    });

    const boxRef = useRef<HTMLDivElement>(null);
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

    const editorRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (editorRef.current) {
            const dynamicHeight: number = Math.min(
                Math.max(numEditorLines - 8, 0) * 20 + 200,
                800
            );
            editorRef.current.style.setProperty(
                "--task-comment-editor-height",
                `${dynamicHeight}px`
            );
        }

        if (numEditorLines !== taskCommentLines) {
            setTaskCommentLines(numEditorLines);
        }
    }, [numEditorLines]);

    useEffect(() => {
        if (selectedEmoji !== null) {
            insertEmoji(selectedEmoji);
        }
    }, [selectedEmoji]);

    useEffect(() => {
        editor.replaceBlocks(editor.document, []);
    }, [task]);

    // Send a new comment.
    //
    // Old behaviour deferred BOTH the optimistic list-append AND the
    // editor-clear to a side effect that listened for
    // `useTM.isTaskCommentUpdated.isUpdate === true`. That flag flips
    // when the server broadcasts the `wsType === "task"` round-trip;
    // unfortunately, the round-trip races with React render passes and
    // — in some host configurations — never reaches this component
    // before the user clicks again. The visible symptom was: comment
    // is persisted in DB, but the editor stays full and the list stays
    // stale until the page is refreshed.
    //
    // The fix is to make this path purely user-driven:
    //   1. Snapshot the editor content while it's still valid.
    //   2. Optimistically append to `taskComments` so the list updates
    //      *now*.
    //   3. Clear the editor *now*.
    //   4. Emit the socket events.
    //   5. Bump `useTM.isTaskCommentUpdated` so other consumers
    //      (TaskPreview's load effect, ThreadCommentsView's load
    //      effect) refetch and replace the optimistic row with server
    //      truth — covering reconciled timestamps / commentId /
    //      mentions etc.
    const sendComment = async () => {
        if (!socket) return;
        if (editor.document.length <= 1) return;
        if (!task.id) return;

        const commentBodySnapshot = editor.document;

        const optimistic = {
            projectId: task.project?.projectId || null,
            taskId: task.id,
            senderId: myself.userId,
            senderName: myself.userName,
            commentId: taskComments.length + 1,
            commentBody: commentBodySnapshot,
            tsSent: getLocalCurrentTimestamp(),
            tsUpdated: getLocalCurrentTimestamp(),
            isEdited: false,
        };

        setTaskComments([...taskComments, optimistic]);
        editor.replaceBlocks(editor.document, []);
        setEditorDocLength(0);
        setNumEditorLines(0);

        socket.emit(
            "task_comment",
            {
                method_type: "POST",
                project_id: task.project?.projectId,
                project_name: task.project?.projectName,
                task_id: task.id,
                comment_body: commentBodySnapshot,
                is_private: task.project?.isPrivate || false,
            },
            (_ack: any) => {
                // Round-trip done: ask the rest of the app to refetch
                // so the optimistic row is replaced with the canonical
                // server payload (correct commentId, ts, mentions…).
                useTM.setIsTaskCommentUpdated({ isUpdate: true, scrollToBottom: true });

                // IMPORTANT: emit the thread_message AFTER the task_comment
                // ack. The backend processes socket events in concurrent
                // threads, so emitting both back-to-back races the auto-
                // bubble's `pm/message/` GET (which counts TaskComments for
                // taskCommentCount) against this comment's INSERT commit.
                // If the GET wins, the broadcast carries a stale count and
                // the bubble's chip reverts to the pre-insert value after
                // our optimistic live-bump. Serializing here guarantees
                // the count read on the server is post-commit.
                if (task.project && task.id) {
                    const updatedTaskThreadMessage =
                        taskThreadMessageForCommentAddedTemplate(myself);
                    socket.emit("thread_message", {
                        methodType: "POST",
                        isInit: false,
                        rootMessageTSSent: "",
                        rootMessageSenderId: null,
                        rootMessageReceiverId: null,
                        threadId: null,
                        threadMessage: updatedTaskThreadMessage,
                        chatType: 3,
                        dmPartnerUserId: null,
                        senderId: task.project.systemUserId,
                        senderName: task.project.projectName,
                        destCGName: task.project.projectName,
                        destCGId: task.project.projectId,
                        taskId: task.id,
                        systemUserId: task.project.systemUserId,
                        messageIdForPut: null,
                        sendActivity: false,
                    });
                }
            }
        );
    };

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
                pickerTopPosition={pickerTopPosition}
                pickerLeftPosition={pickerLeftPosition}
                pickerBottomPosition="auto"
                pickerRightPosition="auto"
                useFixedPosition={true}
                setSelectedEmoji={setSelectedEmoji}
                setShowEmojiPicker={setShowEmojiPicker}
                showEmojiPicker={showEmojiPicker}
            />
            <Box ref={editorRef} className={bnBoxClassName} sx={{ position: "relative" }}>
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
                            sendComment();
                        }
                    }}
                >
                    <EditorSendButton disabled={editorDocLength < 2} onSend={sendComment} />

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
                            <BlockTypeSelect key={"blockTypeSelect"} />

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
                            <CreateLinkButton key={"createLinkButton"} />

                            {/* Extra button to toggle blue text & background */}
                            <CustomEmojiToolbar
                                key={"customButton"}
                                setShowEmojiPicker={setShowEmojiPicker}
                            />
                        </FormattingToolbar>
                    </Box>

                    {/* Adds a mentions menu which opens with the "@" key */}
                    <SuggestionMenuController
                        triggerCharacter={"@"}
                        getItems={async (query) =>
                            // Gets the mentions menu items
                            filterSuggestionItems(
                                MentionMenuItems(
                                    useTEM.teamMemberProfiles,
                                    editor,
                                    useTEM.teamMembers
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
