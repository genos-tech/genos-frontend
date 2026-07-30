/**
 * Ownership recovery, from the CLAIMANT's side of the team profile.
 *
 * The owner answers a claim from their inbox — the claim is an inbox row
 * addressed to them. The claimant is the sender, so the row never
 * reaches their own inbox and this panel is the only place they can see
 * their request or act on it once the deadline passes.
 *
 * Policy lives on the server (`origin/services/ownership_claim.py`);
 * `canRequest` / `canFinalize` come from it rather than being re-derived
 * here, and every button press is re-authorised server-side.
 */
import { useCallback, useEffect, useState } from "react";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import { Alert, Box, Button, Stack, Typography } from "@mui/joy";

import { useAuth } from "../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../i18n";
import { extractYYYYMMDD } from "../../../../utils/dateUtils";
import {
    finalizeOwnershipClaim,
    getOwnershipClaim,
    requestOwnershipClaim,
    type OwnershipClaimStatus,
} from "../../services/ownershipClaim";
import { resolveClaimPanel } from "./ownershipClaimPanelState";

type Props = {
    teamId: string;
    isTeamOwner: boolean;
    /** Called after ownership actually moves, so the modal can refresh. */
    onOwnershipTaken: () => void;
};

export const TeamOwnershipClaimPanel = (props: Props) => {
    const { teamId, isTeamOwner, onOwnershipTaken } = props;
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const [status, setStatus] = useState<OwnershipClaimStatus | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setStatus(await getOwnershipClaim(accessToken, teamId));
    }, [accessToken, teamId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const panel = resolveClaimPanel(status, isTeamOwner);
    if (panel.kind === "none") return null;

    const run = async (action: () => Promise<boolean>, thenNotify?: () => void) => {
        setBusy(true);
        setError(null);
        const ok = await action();
        setBusy(false);
        // Refetch either way: a failure is usually a state change
        // (someone else acted, the owner answered), so the panel should
        // catch up rather than keep showing a button that just refused.
        await refresh();
        if (ok) thenNotify?.();
    };

    const strings = t.common.profileEdit;

    return (
        <Box sx={{ mt: 1.5 }}>
            <Alert
                color={panel.kind === "mine" ? "warning" : "neutral"}
                startDecorator={<ShieldRoundedIcon />}
                sx={{ borderRadius: "10px", alignItems: "flex-start" }}
                variant="soft"
            >
                <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
                    {panel.kind === "request" && (
                        <>
                            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                                {strings.claimTitle}
                            </Typography>
                            <Typography level="body-xs">{strings.claimDescription}</Typography>
                            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                                <Button
                                    color="warning"
                                    disabled={busy}
                                    size="sm"
                                    sx={{ borderRadius: "8px" }}
                                    variant="soft"
                                    onClick={() =>
                                        void run(() =>
                                            requestOwnershipClaim(accessToken, teamId, setError)
                                        )
                                    }
                                >
                                    {strings.claimRequest}
                                </Button>
                            </Box>
                        </>
                    )}

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
                                        void run(
                                            () =>
                                                finalizeOwnershipClaim(
                                                    accessToken,
                                                    panel.itemId,
                                                    setError
                                                ),
                                            onOwnershipTaken
                                        )
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
                            {fmt(strings.claimCooldown, {
                                date: extractYYYYMMDD(panel.until),
                            })}
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
