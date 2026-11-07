import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useRef } from "react";
import { filterSuggestionItems, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
    BasicTextStyleButton,
    BlockTypeSelect,
    ColorStyleButton,
    CreateLinkButton,
    FormattingToolbar,
    FormattingToolbarController,
    SuggestionMenuController,
    useCreateBlockNote,
} from "@blocknote/react";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { useMentionGroupsContext } from "../../context/MentionGroupsContext";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { resolveInsecureFileUrl } from "../../utils/downloadUtils";
import { filterAndRankSuggestionItems } from "../../utils/suggestionRanking";
import { useBlockNoteDictionary } from "./blockNoteI18n";
import { getEmojiSuggestionItems } from "./EmojiSuggestion";
import { useGenosSchema } from "./genos/genosSchema";
import { HashSuggestionMenuController } from "./HashMention";
import { MentionMenuItems, MentionSuggestionMenu } from "./Mention";
import { codeFenceInputRule, getBlockTypeSelectItemsWithCodeBlock } from "./sub/codeBlockExtras";
import { linkHostCaption } from "./sub/linkHostCaption";
import { TAB_INDENT_OPTIONS, tabStaysInEditor } from "./sub/tabIndent";

/** Block types the todo toolbar does not offer. They are in the schema (see above). */
const HIDDEN_BLOCK_TYPES = new Set(["heading", "quote"]);

type BnTodoPreviewProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    body: any[];
    setBody: (text: PartialBlock[] | any[]) => void;
    customClassName?: string;
    useUISM: UIStateManagementState;
    setBodyEdited: (value: boolean) => void;
    useCM: ChatManagementState;
};
export const BnTodoPreview = (props: BnTodoPreviewProps) => {
    const {
        useTEM,
        myself,
        setMyself,
        socket,
        body,
        setBody,
        customClassName,
        useUISM,
        setBodyEdited,
        useCM,
    } = props;
    const { mode } = useColorScheme();
    const bnBoxClassName = customClassName
        ? `${customClassName}-${mode}`
        : `bn-todo-bubble-box-${mode}`;

    const urlLinkModal = useUrlLinkModal();
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);

    const { mentionGroups } = useMentionGroupsContext();

    // The shared Genos schema, with every block type. A todo body used to be built on a
    // smaller schema (no headings, tables, files, images or quotes, and a plain code block),
    // which is the drift MIP-1019 forbids: a schema that lacks a type rejects a body that has
    // one. The toolbar below still offers only what this surface offered (`HIDDEN_BLOCK_TYPES`).
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
    const editor = useCreateBlockNote({
        ...TAB_INDENT_OPTIONS,
        schema,
        resolveFileUrl: resolveInsecureFileUrl,
        // `codeFenceInputRule`: a ``` fence (+ Space or Enter) always makes a code
        // block with a language that exists (see codeBlockExtras.tsx).
        extensions: [codeFenceInputRule, linkHostCaption, tabStaysInEditor],
        dictionary,
        initialContent: body,
    });

    return (
        <Box ref={editorBoxRef} className={bnBoxClassName} sx={{ px: "10px" }}>
            <BlockNoteView
                className="bn-box"
                editable={true}
                editor={editor}
                emojiPicker={false}
                filePanel={false}
                formattingToolbar={false}
                linkToolbar={false}
                sideMenu={false}
                slashMenu={false}
                tableHandles={false}
                theme={mode === "dark" ? "dark" : "light"}
                data-changing-font-demo // custom font
                onChange={() => {
                    setBody(editor.document);
                    setBodyEdited(true);
                }}
            >
                <FormattingToolbarController
                    formattingToolbar={() => (
                        <FormattingToolbar>
                            <BlockTypeSelect
                                key={"blockTypeSelect"}
                                items={getBlockTypeSelectItemsWithCodeBlock(editor).filter(
                                    (item) => !HIDDEN_BLOCK_TYPES.has(item.type)
                                )}
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
                            <CreateLinkButton key={"createLinkButton"} />
                        </FormattingToolbar>
                    )}
                />

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
                    getItems={async (query) => getEmojiSuggestionItems(editor, query)}
                    minQueryLength={2}
                    triggerCharacter={":"}
                />
            </BlockNoteView>
        </Box>
    );
};
