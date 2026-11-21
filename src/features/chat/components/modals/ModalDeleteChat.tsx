import { useEffect, useState } from "react";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Box, Radio, RadioGroup, Typography } from "@mui/joy";

import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";

export type DeleteChatMode = "soft" | "hard";

type Props = {
    open: boolean;
    chatName: string;
    /** Runs the delete. `true` on success; `false` (or a throw) keeps the dialog open with the
     *  error. */
    onConfirm: (mode: DeleteChatMode) => Promise<boolean>;
    onCancel: () => void;
    zIndex?: number;
};

/**
 * Delete a group chat, as its owner (MIP-1705).
 *
 * Two choices, `Delete` first and chosen: it hides the group and keeps every row, so it can be
 * recovered. `Delete permanently` erases the messages, files and the chat, so it asks for the
 * group's name before the button works: the one act in the app a person cannot take back by
 * reading a dialog quickly. Each choice says what it does, and the notes line says what neither
 * touches.
 */
export const ModalDeleteChat = ({ open, chatName, onConfirm, onCancel, zIndex }: Props) => {
    const { t } = useTranslation();
    const copy = t.common.deleteChat;
    const [mode, setMode] = useState<DeleteChatMode>("soft");

    // Every opening starts on the safe choice, not on whatever was picked last time.
    useEffect(() => {
        if (open) setMode("soft");
    }, [open]);

    const hard = mode === "hard";
    const phrase = chatName.trim();

    return (
        <ConfirmDialog
            cancelLabel={copy.cancel}
            confirmLabel={hard ? copy.confirmHard : copy.confirmSoft}
            confirmPhrase={hard && phrase ? phrase : undefined}
            confirmPhraseLabel={copy.typeNameLabel}
            description={copy.description}
            entityName={chatName}
            icon={<DeleteOutlineRoundedIcon sx={{ color: g.danger.text }} />}
            open={open}
            title={copy.title}
            zIndex={zIndex}
            closeOnConfirm
            destructive
            onClose={onCancel}
            onConfirm={async () => {
                if (!(await onConfirm(mode))) throw new Error(copy.genericError);
            }}
        >
            <RadioGroup
                aria-label={copy.title}
                name="delete-chat-mode"
                sx={{ gap: 1.5, mt: 1.5 }}
                value={mode}
                onChange={(event) => setMode(event.target.value as DeleteChatMode)}
            >
                <Box>
                    <Radio label={copy.softLabel} value="soft" />
                    <Typography level="body-xs" sx={{ ml: 3.5, color: g.text.secondary }}>
                        {copy.softHint}
                    </Typography>
                </Box>
                <Box>
                    <Radio color="danger" label={copy.hardLabel} value="hard" />
                    <Typography level="body-xs" sx={{ ml: 3.5, color: g.text.secondary }}>
                        {copy.hardHint}
                    </Typography>
                </Box>
            </RadioGroup>
        </ConfirmDialog>
    );
};
