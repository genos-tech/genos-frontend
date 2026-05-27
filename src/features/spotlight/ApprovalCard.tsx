// Write-tool approval card.
//
// Rendered when the agent loop pauses on a `requires_approval=True`
// tool (currently `create_task`, `update_task`, `add_comment`,
// `create_note`, calendar writes, etc.). Shows the tool name + the
// arguments the model proposed; Approve/Reject buttons resume the
// stream via POST /api/v2/agent/decide/.
//
// Decoupled from the Spotlight i18n shape — labels come in as props so
// both the global Spotlight surface and the per-thread modal can mount
// the same component with surface-specific copy.

import { Box, Button, Typography } from "@mui/joy";

import type { PendingApprovalPayload } from "../../services/agentApi";
import { purplePalette } from "../../theme/purplePalette";

interface ApprovalCardProps {
    pending: PendingApprovalPayload;
    isDark: boolean;
    onApprove: () => void;
    onReject: () => void;
    // Pre-formatted "Approval required: <tool>" heading. The caller
    // does the i18n interpolation so this module stays string-free.
    titleText: string;
    approveLabel: string;
    rejectLabel: string;
}

export const ApprovalCard = ({
    pending,
    isDark,
    onApprove,
    onReject,
    titleText,
    approveLabel,
    rejectLabel,
}: ApprovalCardProps) => {
    const argEntries = Object.entries(pending.arguments || {});
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    return (
        <Box
            sx={{
                mt: 0.75,
                mb: 0.75,
                px: 1.25,
                py: 1,
                borderRadius: "10px",
                border: "1px solid",
                borderColor: palette.warningTintBorder,
                background: palette.warningTintBg,
            }}
        >
            <Typography
                level="body-sm"
                sx={{
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: palette.warningTint,
                    mb: 0.5,
                }}
            >
                {titleText}
            </Typography>
            {argEntries.length > 0 && (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.15,
                        mb: 0.75,
                        fontSize: "0.9375rem",
                        fontFamily: "monospace",
                        opacity: 0.9,
                    }}
                >
                    {argEntries.map(([k, v]) => (
                        <Box key={k} sx={{ display: "flex", gap: 0.5 }}>
                            <Box component="span" sx={{ opacity: 0.8 }}>
                                {k}:
                            </Box>
                            <Box component="span" sx={{ flex: 1, wordBreak: "break-word" }}>
                                {typeof v === "string" ? v : JSON.stringify(v)}
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}
            <Box sx={{ display: "flex", gap: 0.75 }}>
                <Button
                    color="success"
                    size="sm"
                    sx={{ fontSize: "0.9375rem" }}
                    variant="solid"
                    onClick={onApprove}
                >
                    {approveLabel}
                </Button>
                <Button
                    color="neutral"
                    size="sm"
                    sx={{ fontSize: "0.9375rem" }}
                    variant="outlined"
                    onClick={onReject}
                >
                    {rejectLabel}
                </Button>
            </Box>
        </Box>
    );
};
