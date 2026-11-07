/**
 * Confirm step for filing an ownership claim.
 *
 * The button that opens this sits in the team profile's action row next
 * to Invite members, where it is one word with no context. This modal is
 * where the two things that make the action reasonable get said: the
 * current owner is notified immediately, and nothing happens for
 * `responseDays` days. Without that, "Request ownership" reads either
 * as instant escalation or as a support ticket, and it is neither.
 *
 * Shaped after ModalLeaveConfirm, but warning-toned rather than danger:
 * this asks someone for something, it doesn't destroy anything.
 */
import { useState } from "react";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Button, Typography } from "@mui/joy";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { fmt, useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";

type Props = {
    open: boolean;
    teamName: string;
    /** How long the owner has to answer, from the server. */
    responseDays: number;
    /** Resolves true when the claim was filed, which closes the modal. */
    onConfirm: () => Promise<boolean>;
    onCancel: () => void;
};

export const ModalRequestOwnership = ({
    open,
    teamName,
    responseDays,
    onConfirm,
    onCancel,
}: Props) => {
    const { t } = useTranslation();
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const strings = t.common.profileEdit;

    const handleClose = () => {
        if (submitting) return;
        setErrorMessage(null);
        onCancel();
    };

    const handleConfirm = async () => {
        if (submitting) return;
        setSubmitting(true);
        setErrorMessage(null);
        try {
            const ok = await onConfirm();
            if (ok) {
                handleCloseAfterSuccess();
            } else {
                setErrorMessage(strings.claimError);
            }
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : strings.claimError);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCloseAfterSuccess = () => {
        setErrorMessage(null);
        onCancel();
    };

    return (
        <ModalFrame
            description={teamName}
            dismissible={!submitting}
            icon={<ShieldRoundedIcon sx={{ color: g.warning.text }} />}
            open={open}
            size="md"
            title={strings.claimConfirmTitle}
            zIndex={10010}
            actions={
                <>
                    <Button
                        color="neutral"
                        disabled={submitting}
                        variant="plain"
                        onClick={handleClose}
                    >
                        {t.common.actions.cancel}
                    </Button>
                    <Button
                        color="warning"
                        loading={submitting}
                        variant="solid"
                        onClick={handleConfirm}
                    >
                        {strings.claimConfirmSend}
                    </Button>
                </>
            }
            onClose={handleClose}
        >
            <Typography level="body-sm" sx={{ color: g.text.secondary, mb: 1.5 }}>
                {strings.claimDescription}
            </Typography>

            {/* The part that stops this reading as an escalate-now
                button: the owner hears about it immediately, and
                nothing moves for a month. */}
            <Typography
                level="body-sm"
                sx={{
                    color: g.text.primary,
                    background: g.warning.subtle,
                    border: `1px solid ${g.warning.border}`,
                    borderRadius: g.radius.md,
                    p: 1.5,
                }}
            >
                {fmt(strings.claimConfirmWindow, { days: String(responseDays) })}
            </Typography>

            {errorMessage && (
                <Alert color="danger" startDecorator={<WarningAmberIcon />} sx={{ mt: 2 }}>
                    {errorMessage}
                </Alert>
            )}
        </ModalFrame>
    );
};
