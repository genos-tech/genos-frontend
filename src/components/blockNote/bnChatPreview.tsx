import { Socket } from "socket.io-client";
import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import {
    PartialBlock,
    BlockNoteSchema,
    defaultInlineContentSpecs,
    defaultBlockSpecs,
} from "@blocknote/core";
import { codeBlock } from "@blocknote/code-block";

import { CreateMentionSpec } from "./Mention";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";

type BnChatPreviewProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    socket: Socket | null;
    content: PartialBlock[] | any[];
    isSent: boolean;
    customClassName?: string;
    setCurrentChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
};
export const BnChatPreview = (props: BnChatPreviewProps) => {
    const {
        teamMemberProfiles,
        myself,
        socket,
        content,
        isSent,
        customClassName,
        setCurrentChat,
        setOpeningService,
    } = props;
    const { mode } = useColorScheme();
    const _bnBoxClassName: string = isSent
        ? `bn-message-bubble-box-${mode}-me`
        : `bn-message-bubble-box-${mode}`;
    const bnBoxClassName = customClassName ? `${customClassName}-${mode}` : _bnBoxClassName;

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
                setOpeningService,
                setCurrentChat
            ),
        },
        blockSpecs: {
            // remainingBlockSpecs contains all the other blocks
            ...remainingBlockSpecs,
        },
    });

    const editor = useCreateBlockNote({
        schema,
        codeBlock,
        initialContent: content.slice(0, -1),
    });

    return (
        <Box className={bnBoxClassName}>
            <BlockNoteView
                editor={editor}
                editable={false}
                formattingToolbar={false}
                linkToolbar={false}
                filePanel={false}
                sideMenu={false}
                slashMenu={false}
                tableHandles={false}
                data-changing-font-demo // custom font
            ></BlockNoteView>
        </Box>
    );
};
