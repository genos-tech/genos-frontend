/**
 * Ownership-recovery STATUS, in the team profile.
 *
 * Renders what is already in flight — my pending claim, someone else's,
 * or my rejection cooldown. The action that STARTS one lives in the
 * profile's button row next to Invite members (`ModalRequestOwnership`),
 * so the `request` state draws nothing here.
 *
 * This is the claimant's only view of their own claim: the claim is an
 * inbox row addressed to the owner, so it never reaches the sender's own
 * inbox, and "take ownership" has nowhere else to live.
 */
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import { Alert, Box, Button, Stack, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../../i18n";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import type { OwnershipClaimControls } from "./useOwnershipClaim";

type Props = {
    claim: OwnershipClaimControls;
    /** Called after ownership actually moves, so the modal can refresh. */
    onOwnershipTaken: () => void;
};

export const TeamOwnershipClaimPanel = ({ claim, onOwnershipTaken }: Props) => {
    const { t } = useTranslation();
    const { panel, busy, error } = claim;
    const strings = t.common.profileEdit;

    // "request" is drawn as a button in the action row, not here.
    if (panel.kind === "none" || panel.kind === "request") return null;

    return (
        <Box sx={{ mt: 1.5 }}>
            <Alert
                color={panel.kind === "mine" ? "warning" : "neutral"}
                startDecorator={<ShieldRoundedIcon />}
                sx={{ borderRadius: "10px", alignItems: "flex-start" }}
                variant="soft"
            >
                <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
                    {panel.kind === "mine" && (
                        <>
                            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                                {strings.claimPendingTitle}
                            </Typography>
                            <Typography level="body-xs">
                                {panel.canFinalize
                                    ? strings.claimReady
                                    : panel.deadline
                                      ? fmt(strings.claimWaiting, {
                                            date: extractYYYYMMDD(panel.deadline),
                                        })
                                      : strings.claimPendingTitle}
                            </Typography>
                            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                                {/* Rendered even before the deadline, and
                                    disabled: hiding it until the day
                                    leaves the claimant with no sign that
                                    finalizing is how this ends. */}
                                <Button
                                    color="warning"
                                    disabled={busy || !panel.canFinalize}
                                    size="sm"
                                    sx={{ borderRadius: "8px" }}
                                    variant="solid"
                                    onClick={() =>
                                        void claim.finalize(panel.itemId).then((ok) => {
                                            if (ok) onOwnershipTaken();
                                        })
                                    }
                                >
                                    {strings.claimFinalize}
                                </Button>
                            </Box>
                        </>
                    )}

                    {panel.kind === "other" && (
                        <Typography level="body-xs">
                            {panel.deadline
                                ? fmt(strings.claimOtherPending, {
                                      date: extractYYYYMMDD(panel.deadline),
                                  })
                                : strings.claimPendingTitle}
                        </Typography>
                    )}

                    {panel.kind === "cooldown" && (
                        <Typography level="body-xs">
                            {fmt(strings.claimCooldown, { date: extractYYYYMMDD(panel.until) })}
                        </Typography>
                    )}

                    {error && (
                        <Typography color="danger" level="body-xs">
                            {error}
                        </Typography>
                    )}
                </Stack>
            </Alert>
        </Box>
    );
};
