import { Socket } from "socket.io-client";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import {
    BasicTextStyleButton,
    ColorStyleButton,
    CreateLinkButton,
    FormattingToolbarController,
    FormattingToolbar,
    useCreateBlockNote,
    SuggestionMenuController,
    BlockTypeSelect,
} from "@blocknote/react";
import {
    BlockNoteSchema,
    defaultInlineContentSpecs,
    filterSuggestionItems,
    defaultBlockSpecs,
    PartialBlock,
} from "@blocknote/core";
import { en } from "@blocknote/core/locales";

import { CreateMentionSpec, MentionMenuItems } from "./Mention";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";

type BnTodoPreviewProps = {
    teamMemberProfiles: Record<string, UserProps>;
    teamMembers: UserProps[];
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    body: any[];
    setBody: (text: PartialBlock[] | any[]) => void;
    customClassName?: string;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
    setBodyEdited: (value: boolean) => void;
};
export const BnTodoPreview = (props: BnTodoPreviewProps) => {
    const {
        teamMemberProfiles,
        teamMembers,
        myself,
        setMyself,
        socket,
        body,
        setBody,
        customClassName,
        setCurrentChat,
        setOpeningService,
        setBodyEdited,
    } = props;
    const { mode } = useColorScheme();
    const bnBoxClassName = customClassName
        ? `${customClassName}-${mode}`
        : `bn-todo-bubble-box-${mode}`;

    // Disable the Audio and Image blocks from the built-in schema
    // This is done by picking out the blocks you want to disable
    const { heading, table, file, audio, image, video, quote, ...remainingBlockSpecs } =
        defaultBlockSpecs;

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

    // We use the English, default dictionary
    const locale = en;
    const initialContent: any[] = body.slice(0, -1);
    const editor = useCreateBlockNote({
        schema,
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

    return (
        <Box className={bnBoxClassName} sx={{ px: "10px" }}>
            <BlockNoteView
                className="bn-box"
                editor={editor}
                editable={true}
                formattingToolbar={false}
                linkToolbar={false}
                filePanel={false}
                sideMenu={false}
                slashMenu={false}
                tableHandles={false}
                data-changing-font-demo // custom font
                onChange={() => {
                    setBody(editor.document);
                    setBodyEdited(true);
                }}
            >
                <FormattingToolbarController
                    formattingToolbar={() => (
                        <FormattingToolbar>
                            <BlockTypeSelect key={"blockTypeSelect"} />

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
                        </FormattingToolbar>
                    )}
                />

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
            </BlockNoteView>
        </Box>
    );
};
