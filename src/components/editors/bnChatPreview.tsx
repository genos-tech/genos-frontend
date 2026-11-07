import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useMemo, useRef, useState } from "react";
import { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import DownloadIcon from "@mui/icons-material/Download";
import { Box, IconButton, Modal, ModalDialog, Stack } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { withoutTrailingBlank } from "./utils/messageBlocks";

import { useAuth } from "../../context/AuthContext";
import { LazyPrCard } from "../../features/integrations/components/LazyPrCard";
import { extractPrUrlsFromBlocks } from "../../features/integrations/utils/extractPrUrls";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { useAnchorClickIntercept } from "../../hooks/common/useAnchorClickIntercept";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../i18n";
import { UserProps } from "../../types/admin";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { downloadFile, resolveInsecureFileUrl } from "../../utils/downloadUtils";
import { AppTooltip } from "../ui/AppTooltip";
import { useBlockNoteDictionary } from "./blockNoteI18n";
import { useGenosSchema } from "./genos/genosSchema";

// Cap the number of inline PR previews per message body. Anyone pasting
// more than this is abusing the channel; the rest are silently dropped.
const MAX_PR_UNFURLS = 4;

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
    const { t } = useTranslation();
    const dictionary = useBlockNoteDictionary();
    const _bnBoxClassName: string = isSent
        ? `bn-message-bubble-box-${mode}-me`
        : `bn-message-bubble-box-${mode}`;
    const bnBoxClassName = customClassName ? `${customClassName}-${mode}` : _bnBoxClassName;

    // The shared Genos schema (`genos/genosSchema.ts`). Built once per mount on purpose:
    // `useCreateBlockNote` below builds the editor once and keeps its first schema, so
    // rebuilding on later renders was one full spec build per visible bubble per re-render,
    // thrown away. `mentionGroup` and the other chips are in it so a historical message
    // that carries one is not rejected with "node type not found in schema".
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

    const editor = useCreateBlockNote({
        schema,
        dictionary,
        // Upgrade http:// media URLs baked into saved image/file blocks to
        // https:// so the HTTPS SPA renders them without a Mixed-Content
        // warning (older bodies carry an http scheme; see the helper).
        resolveFileUrl: resolveInsecureFileUrl,
        // Drops the stored trailing blank line, and only that: a message typed
        // since BlockNote 0.57 may not end with one, and a blind `slice(0, -1)`
        // hid its last real line (MIP-1039).
        initialContent: withoutTrailingBlank(content),
    });

    // State for modal
    const [opened, setOpened] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // Global URL-link modal opener. Null when the provider isn't mounted
    // (e.g. signin / signup), in which case anchor clicks fall through
    // to the browser's default — same as before this feature shipped.
    const urlLinkModal = useUrlLinkModal();
    const { accessToken } = useAuth();

    // Scan the message body for GitHub PR URLs once per content change
    // and render a PR card per match below the body (loaded on hover). Memoized so
    // Virtuoso scroll re-renders don't re-walk the document. Caps at
    // MAX_PR_UNFURLS to keep noisy paste-bombs in check.
    const prUrls = useMemo(
        () => extractPrUrlsFromBlocks(content).slice(0, MAX_PR_UNFURLS),
        [content]
    );
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
        if (target.tagName === "IMG" && !target.hasAttribute("data-custom-emoji")) {
            // (custom emoji are inline <img>s, not
            // zoomable/downloadable image blocks)
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
        // `--bn-preview-box-px` is the same 10px this always used — named so
        // callers that render something ALONGSIDE a preview (the inbox card's
        // chips) can line up with the body text instead of guessing at the
        // padding between them. See `--inbox-preview-indent` in App.css.
        <Box ref={editorBoxRef} className={bnBoxClassName} sx={{ px: "var(--bn-preview-box-px)" }}>
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

            {prUrls.length > 0 && accessToken && (
                <Stack spacing={0.75} sx={{ mt: 0.75, mb: 0.5 }}>
                    {prUrls.map((url) => (
                        <LazyPrCard
                            key={url}
                            accessToken={accessToken}
                            url={url}
                            hideOnNotConnected
                        />
                    ))}
                </Stack>
            )}

            <Modal open={opened} sx={{ zIndex: 10010 }} onClose={() => setOpened(false)}>
                <ModalDialog>
                    {selectedImage ? (
                        <Box>
                            <img
                                alt={t.common.editor.imagePreviewAlt}
                                src={selectedImage}
                                style={{
                                    maxWidth: "80vw",
                                    maxHeight: "80vh",
                                    display: "block",
                                }}
                            />
                            <AppTooltip placement="top" size="sm" title={t.common.editor.download}>
                                <IconButton
                                    color="neutral"
                                    sx={{ position: "absolute", top: "10px", right: "10px" }}
                                    variant="solid"
                                    onClick={() => handleDownload(selectedImage)}
                                >
                                    <DownloadIcon />
                                </IconButton>
                            </AppTooltip>
                        </Box>
                    ) : null}
                </ModalDialog>
            </Modal>
        </Box>
    );
};
