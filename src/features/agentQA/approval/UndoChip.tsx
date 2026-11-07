// "Can't be undone": what an approval card says BEFORE the person approves a
// write that Undo will not be able to take back (genos-api `undo.proposal`).
//
// `pending.undoable` is a PREDICTION, and only `false` is a claim: absent (an
// older backend) or `true` shows nothing. The reason is the server's `undo_reason`
// code, worded here; a code this client does not know reads as the generic one.
//
// Quiet by design: a small neutral chip and a muted line, so the card stays about
// the write. The one that deletes for good (`irreversible_delete`) is stronger. The
// card itself is warning-tinted, so a warning chip would vanish into it: danger is
// the colour that reads on that background.

import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import { Box, Chip, Typography } from "@mui/joy";

import { useTranslation } from "../../../i18n";
import type { PendingApprovalPayload } from "../../../services/agentApi";
import { g } from "../../../theme/tokens";

export const UndoChip = ({
    pending,
}: {
    pending: Pick<PendingApprovalPayload, "undoable" | "undo_reason">;
}) => {
    const { t } = useTranslation();
    if (pending.undoable !== false) return null;

    const reasons = t.agentApproval.undo.reasons as Record<string, string>;
    const code = pending.undo_reason ?? "";
    const strong = code === "irreversible_delete";
    const reason = reasons[code] ?? reasons.not_yet;

    return (
        <Box
            data-testid="undo-chip"
            data-undo-reason={code || "unknown"}
            sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 0.75,
                mb: 0.75,
            }}
        >
            <Chip
                size="sm"
                startDecorator={<BlockRoundedIcon sx={{ fontSize: 14 }} />}
                variant="soft"
                sx={{
                    fontSize: "0.75rem",
                    "--Chip-minHeight": "20px",
                    ...(strong
                        ? {
                              color: g.danger.text,
                              background: g.danger.subtle,
                              border: "1px solid",
                              borderColor: g.danger.border,
                          }
                        : {}),
                }}
            >
                {t.agentApproval.undo.chip}
            </Chip>
            <Typography
                level="body-xs"
                sx={{ color: strong ? g.danger.text : g.text.secondary, minWidth: 0 }}
            >
                {reason}
            </Typography>
        </Box>
    );
};
