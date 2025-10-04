import { Socket } from "socket.io-client";
import { Box, Modal, ModalDialog, Button, IconButton, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote, FormattingToolbar, FileDownloadButton } from "@blocknote/react";
import {
    PartialBlock,
    BlockNoteSchema,
    defaultInlineContentSpecs,
    defaultBlockSpecs,
} from "@blocknote/core";
import { codeBlock } from "@blocknote/code-block";
import DownloadIcon from "@mui/icons-material/Download";

import { CreateMentionSpec } from "./Mention";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import { useState } from "react";
import { downloadFile } from "../../utils/downloadUtils";
import { getCurrentTimestamp } from "../../utils/dateUtils";

type BnChatPreviewProps = {
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
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
        setMyself,
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
    const { audio, video, ...remainingBlockSpecs } = defaultBlockSpecs;

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

    const editor = useCreateBlockNote({
        schema,
        codeBlock,
        initialContent: content.slice(0, -1),
    });

    // State for modal
    const [opened, setOpened] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Custom click handler
    const handleImageClick = (src: string) => {
        setSelectedImage(src);
        setOpened(true);
    };

    const handleDownload = async (
        url: string,
        filename = `image-${getCurrentTimestamp()}.png`
    ) => {
        await downloadFile(url, filename);
    };

    return (
        <Box className={bnBoxClassName} sx={{ px: "10px" }}>
            <BlockNoteView
                className="bn-box"
                editor={editor}
                editable={false}
                formattingToolbar={false}
                linkToolbar={false}
                filePanel={false}
                sideMenu={false}
                slashMenu={false}
                tableHandles={false}
                data-changing-font-demo // custom font
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.tagName === "IMG") {
                        handleImageClick((target as HTMLImageElement).src);
                    }
                }}
            ></BlockNoteView>

            <Modal sx={{ zIndex: 10010 }} open={opened} onClose={() => setOpened(false)}>
                <ModalDialog>
                    {selectedImage ? (
                        <Box>
                            <img src={selectedImage} alt="preview" />
                            <Tooltip
                                placement="top"
                                title="Download"
                                sx={{ zIndex: 10010 }}
                                component="div"
                            >
                                <IconButton
                                    onClick={() => handleDownload(selectedImage)}
                                    color="neutral"
                                    variant="solid"
                                    sx={{ position: "absolute", top: "10px", right: "10px" }}
                                >
                                    <DownloadIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    ) : null}
                </ModalDialog>
            </Modal>
        </Box>
    );
};
