import { Socket } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import { useColorScheme } from "@mui/joy/styles";
import { Box, IconButton, Tooltip } from "@mui/joy";
import SendIcon from "@mui/icons-material/Send";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { codeBlock } from "@blocknote/code-block";
import {
    BasicTextStyleButton,
    BlockTypeSelect,
    ColorStyleButton,
    CreateLinkButton,
    FileCaptionButton,
    FileReplaceButton,
    FormattingToolbar,
    useCreateBlockNote,
    DefaultReactSuggestionItem,
    SuggestionMenuController,
    getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import {
    BlockNoteSchema,
    defaultInlineContentSpecs,
    filterSuggestionItems,
    defaultBlockSpecs,
} from "@blocknote/core";

import { CustomEmojiToolbar } from "./customEmojiToolbar";
import { CreateMentionSpec, MentionMenuItems } from "./Mention";
import { EmojiPicker } from "../emojiInput/EmojiPicker";
import { UserProps } from "../../types/admin";
import { TaskCommentProps, TaskProps } from "../../types/tasks";
import { ChatProps } from "../../types/chat";
import { getCurrentTimestamp } from "../../utils/dateUtils";
import { taskThreadMessageForCommentAddedTemplate } from "../../features/tasks/utils/TaskMessageTemplate";
import "../../App.css";

type BnTaskCommentEditorProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    teamMembers: UserProps[];
    task: TaskProps;
    setTaskUpdated?: (value: boolean) => void;
    taskComments: TaskCommentProps[];
    setTaskComments: (value: TaskCommentProps[]) => void;
    isCommentUpdated: { isUpdate: boolean; scrollToBottom: boolean };
    setIsCommentUpdated: (value: { isUpdate: boolean; scrollToBottom: boolean }) => void;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
    taskCommentLines: number;
    setTaskCommentLines: (value: number) => void;
};

export const BnTaskCommentEditor = (props: BnTaskCommentEditorProps) => {
    const {
        teamMemberProfiles,
        myself,
        setMyself,
        socket,
        teamMembers,
        task,
        setTaskUpdated,
        taskComments,
        setTaskComments,
        isCommentUpdated,
        setIsCommentUpdated,
        setCurrentChat,
        setOpeningService,
        taskCommentLines,
        setTaskCommentLines,
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
                teamMemberProfiles,
                socket,
                myself,
                setMyself,
                setOpeningService,
                setCurrentChat
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
        codeBlock,
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
        if (isCommentUpdated && isCommentUpdated.isUpdate === true && task.id) {
            setTaskComments([
                ...taskComments,
                {
                    taskId: task.id,
                    senderId: myself.userId,
                    senderName: myself.userName,
                    commentId: taskComments.length + 1,
                    commentBody: editor.document,
                    tsSent: getCurrentTimestamp(),
                    tsUpdated: getCurrentTimestamp(),
                    isEdited: false,
                },
            ]);
            editor.replaceBlocks(editor.document, []);
            setIsCommentUpdated({ isUpdate: false, scrollToBottom: false });
        }
    }, [isCommentUpdated, taskComments]);

    useEffect(() => {
        editor.replaceBlocks(editor.document, []);
    }, [task]);

    const sendComment = async () => {
        if (socket) {
            if (editor.document.length > 1) {
                socket.emit(
                    "task_comment",
                    {
                        method_type: "POST",
                        project_id: task.project?.projectId,
                        project_name: task.project?.projectName,
                        task_id: task.id,
                        comment_body: editor.document,
                        is_private: task.project?.isPrivate || false,
                    },
                    (ack: any) => {
                        setIsCommentUpdated({ isUpdate: true, scrollToBottom: true });
                    }
                );

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
        }
    };

    const [pickerBottomPosition, setPickerBottomPosition] = useState<number>(0);
    const [pickerRightPosition, setPickerRightPosition] = useState<number>(0);
    useEffect(() => {
        if (boxRef.current) {
            const rect = boxRef.current.getBoundingClientRect();
            setPickerBottomPosition(rect.bottom - 1350);
            setPickerRightPosition(rect.left - 800);
        }
    }, [task, showEmojiPicker]);

    return (
        <Box ref={boxRef}>
            <EmojiPicker
                showEmojiPicker={showEmojiPicker}
                setShowEmojiPicker={setShowEmojiPicker}
                setSelectedEmoji={setSelectedEmoji}
                pickerBottomPosition={pickerBottomPosition}
                pickerRightPosition={pickerRightPosition}
            />
            <Box sx={{ position: "relative" }} className={bnBoxClassName} ref={editorRef}>
                <BlockNoteView
                    className="bn-box"
                    editor={editor}
                    sideMenu={false} // false for Chat/comment, true for Task content
                    theme={mode === "dark" ? "dark" : "light"}
                    formattingToolbar={false}
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
                    <Tooltip title="Edit in Modal (TBD)">
                        <IconButton
                            size="sm"
                            color="neutral"
                            variant="plain"
                            sx={{
                                position: "absolute",
                                top: "5%",
                                right: "1%",
                                zIndex: 1,
                                p: 0.7,
                            }}
                        >
                            <OpenInNewIcon />
                        </IconButton>
                    </Tooltip>

                    <IconButton
                        size="sm"
                        color="success"
                        variant="solid"
                        sx={{
                            position: "absolute",
                            bottom: "5%",
                            right: "1%",
                            zIndex: 1,
                            p: 0.7,
                        }}
                        disabled={editorDocLength < 2}
                        onClick={sendComment}
                    >
                        <SendIcon sx={{ mr: "3px" }} />
                        Send
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
                            <BlockTypeSelect key={"blockTypeSelect"} />

                            <FileCaptionButton key={"fileCaptionButton"} />
                            <FileReplaceButton key={"replaceFileButton"} />

                            <BasicTextStyleButton
                                basicTextStyle={"bold"}
                                key={"boldStyleButton"}
                            />
                            <BasicTextStyleButton
                                basicTextStyle={"italic"}
                                key={"italicStyleButton"}
                            />
                            <BasicTextStyleButton
                                basicTextStyle={"underline"}
                                key={"underlineStyleButton"}
                            />
                            <BasicTextStyleButton
                                basicTextStyle={"strike"}
                                key={"strikeStyleButton"}
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
                                MentionMenuItems(teamMemberProfiles, editor, teamMembers),
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
                </BlockNoteView>
            </Box>
        </Box>
    );
};
