import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useRef, useState } from "react";
import { codeBlockOptions } from "@blocknote/code-block";
import {
    BlockNoteSchema,
    createCodeBlockSpec,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
    PartialBlock,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import DownloadIcon from "@mui/icons-material/Download";
import { Box, IconButton, Modal, ModalDialog, Tooltip } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { downloadFile } from "../../utils/downloadUtils";
import { CreateMentionSpec } from "./Mention";

type BnChatPreviewProps = {
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    socket: Socket | null;
    content: PartialBlock[] | any[];
    isSent: boolean;
    customClassName?: string;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
};
export const BnChatPreview = (props: BnChatPreviewProps) => {
    const { useTEM, myself, setMyself, socket, content, isSent, customClassName, useUISM, useCM } =
        props;
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
            // BlockNote 0.49 moved the code-block options out of
            // `useCreateBlockNote` and into the schema. We override
            // the default plain-text codeBlock with the syntax-
            // highlighted one shipped by `@blocknote/code-block`.
            codeBlock: createCodeBlockSpec(codeBlockOptions),
        },
    });

    const editor = useCreateBlockNote({
        schema,
        initialContent: content.slice(0, -1),
    });

    // State for modal
    const [opened, setOpened] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Global URL-link modal opener. Null when the provider isn't mounted
    // (e.g. signin / signup), in which case anchor clicks fall through
    // to the browser's default — same as before this feature shipped.
    const urlLinkModal = useUrlLinkModal();
    // Native capture-phase anchor interceptor — see the hook for why we
    // use a direct DOM listener instead of React's onClickCapture.
    const editorBoxRef = useRef<HTMLDivElement>(null);
    useAnchorClickIntercept(editorBoxRef, urlLinkModal);

    // Custom click handler
    const handleImageClick = (src: string) => {
        setSelectedImage(src);
        setOpened(true);
    };

    const handleDownload = async (
        url: string,
        filename = `chat-message-image-${getLocalCurrentTimestamp()}.png`
    ) => {
        await downloadFile(url, filename);
    };

    const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Anchor clicks are intercepted by `useAnchorClickIntercept`
        // above (native capture-phase listener). This handler only
        // deals with image + file clicks.
        const target = e.target as HTMLElement;

        // Handle image clicks
        if (target.tagName === "IMG") {
            handleImageClick((target as HTMLImageElement).src);
            return;
        }

        // Handle file block clicks - find the closest file block wrapper
        const fileWrapper = target.closest('[data-content-type="file"]');
        if (fileWrapper) {
            e.preventDefault();
            const blockContainer = fileWrapper.closest("[data-id]");
            const blockId = blockContainer?.getAttribute("data-id");
            if (blockId) {
                const block = editor.document.find((b: any) => b.id === blockId);
                if (block && block.type === "file" && block.props?.url) {
                    downloadFile(block.props.url, block.props.name || undefined);
                }
            }
        }
    };

    return (
        <Box ref={editorBoxRef} className={bnBoxClassName} sx={{ px: "10px" }}>
            <BlockNoteView
                className="bn-box"
                editable={false}
                editor={editor}
                filePanel={false}
                formattingToolbar={false}
                linkToolbar={false}
                sideMenu={false}
                slashMenu={false}
                tableHandles={false}
                data-changing-font-demo // custom font
                onClick={handleEditorClick}
            ></BlockNoteView>

            <Modal open={opened} sx={{ zIndex: 10010 }} onClose={() => setOpened(false)}>
                <ModalDialog>
                    {selectedImage ? (
                        <Box>
                            <img
                                alt="preview"
                                src={selectedImage}
                                style={{
                                    maxWidth: "80vw",
                                    maxHeight: "80vh",
                                    display: "block",
                                }}
                            />
                            <Tooltip
                                component="div"
                                placement="top"
                                size="sm"
                                sx={{ zIndex: 10010 }}
                                title="Download"
                                variant="outlined"
                            >
                                <IconButton
                                    color="neutral"
                                    sx={{ position: "absolute", top: "10px", right: "10px" }}
                                    variant="solid"
                                    onClick={() => handleDownload(selectedImage)}
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
