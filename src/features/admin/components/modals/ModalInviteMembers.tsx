import { useEffect, useState } from "react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Chip, Input, Stack, Typography } from "@mui/joy";

import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../../context/AuthContext";
import { ValidationUtils } from "../../../../db/utils/validation";
import { useTranslation } from "../../../../i18n";
import { fmt } from "../../../../i18n/interpolate";
import { g } from "../../../../theme/tokens";
import {
    InviteResult,
    InviteResultStatus,
    inviteTeamMembers,
} from "../../services/inviteTeamMembers";

type Props = {
    open: boolean;
    teamId: string;
    onClose: () => void;
    /** Present → invite GUESTS scoped to this project instead of team
     *  members. The modal's copy changes with it, because "invite to the
     *  team" is the wrong promise to make to an outside collaborator. */
    projectId?: number | null;
    projectName?: string;
};

// Per-status icon + accent colour for the results list.
const STATUS_META: Record<InviteResultStatus, { color: string; Icon: typeof InfoRoundedIcon }> = {
    sent: { color: g.success.text, Icon: CheckCircleRoundedIcon },
    already_invited_resent: { color: g.accent.text, Icon: MarkEmailReadRoundedIcon },
    already_member: { color: g.text.secondary, Icon: InfoRoundedIcon },
    invalid_email: { color: g.warning.text, Icon: WarningAmberIcon },
    failed: { color: g.danger.text, Icon: ErrorOutlineRoundedIcon },
};

export const ModalInviteMembers = ({ open, teamId, onClose, projectId, projectName }: Props) => {
    const asGuest = projectId != null;
    const { accessToken } = useAuth();
    const { t } = useTranslation();

    const [draft, setDraft] = useState("");
    const [emails, setEmails] = useState<string[]>([]);
    const [inputError, setInputError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [results, setResults] = useState<InviteResult[] | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Fresh start every time the modal closes.
    useEffect(() => {
        if (!open) {
            setDraft("");
            setEmails([]);
            setInputError(null);
            setSubmitting(false);
            setResults(null);
            setErrorMessage(null);
        }
    }, [open]);

    const addChip = (raw: string) => {
        const email = raw.trim().toLowerCase();
        if (!email) return;
        if (!ValidationUtils.isValidEmail(email)) {
            setInputError(t.admin.inviteMembers.invalidEmail);
            return;
        }
        if (emails.includes(email)) {
            setInputError(t.admin.inviteMembers.duplicateEmail);
            return;
        }
        setEmails((prev) => [...prev, email]);
        setDraft("");
        setInputError(null);
    };

    const removeChip = (email: string) => {
        setEmails((prev) => prev.filter((e) => e !== email));
    };

    const handleSend = async () => {
        if (submitting || emails.length === 0) return;
        setSubmitting(true);
        setErrorMessage(null);
        const res = await inviteTeamMembers(
            accessToken,
            teamId,
            emails,
            setErrorMessage,
            projectId
        );
        setSubmitting(false);
        if (res) {
            setResults(res);
            setEmails([]);
            setDraft("");
        }
    };

    const handleClose = () => {
        if (submitting) return;
        onClose();
    };

    return (
        <ModalFrame
            dismissible={!submitting}
            icon={<PersonAddAltRoundedIcon sx={{ color: g.accent.text }} />}
            open={open}
            size="md"
            zIndex={10010}
            actions={
                results ? (
                    <>
                        <Button
                            color="neutral"
                            variant="plain"
                            onClick={() => {
                                setResults(null);
                                setErrorMessage(null);
                            }}
                        >
                            {t.admin.inviteMembers.inviteMore}
                        </Button>
                        <Button onClick={handleClose}>{t.admin.inviteMembers.done}</Button>
                    </>
                ) : (
                    <>
                        <Button
                            color="neutral"
                            disabled={submitting}
                            variant="plain"
                            onClick={handleClose}
                        >
                            {t.admin.inviteMembers.cancel}
                        </Button>
                        <Button
                            disabled={emails.length === 0}
                            loading={submitting}
                            onClick={handleSend}
                        >
                            {submitting
                                ? t.admin.inviteMembers.sending
                                : t.admin.inviteMembers.send}
                        </Button>
                    </>
                )
            }
            description={
                asGuest ? t.admin.inviteMembers.subtitleGuest : t.admin.inviteMembers.subtitle
            }
            title={
                asGuest
                    ? fmt(t.admin.inviteMembers.titleGuest, { projectName: projectName ?? "" })
                    : t.admin.inviteMembers.title
            }
            onClose={handleClose}
        >
            {results ? (
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <Typography level="title-sm" sx={{ color: g.text.secondary, mb: 1 }}>
                        {t.admin.inviteMembers.resultsTitle}
                    </Typography>
                    <Box
                        sx={{
                            maxHeight: 280,
                            overflow: "auto",
                            borderRadius: g.radius.md,
                            border: `1px solid ${g.border.default}`,
                            background: g.bg.subtle,
                            p: 1,
                            mb: 1,
                        }}
                    >
                        {results.map((r) => {
                            const meta = STATUS_META[r.status];
                            const Icon = meta.Icon;
                            return (
                                <Stack
                                    key={`invite-result-${r.email}`}
                                    alignItems="center"
                                    direction="row"
                                    spacing={1.25}
                                    sx={{ px: 1, py: 0.75 }}
                                >
                                    <Icon sx={{ fontSize: 18, color: meta.color }} />
                                    <Typography
                                        level="body-sm"
                                        sx={{ color: g.text.primary, flex: 1, minWidth: 0 }}
                                        noWrap
                                    >
                                        {r.email}
                                    </Typography>
                                    <Typography
                                        level="body-xs"
                                        sx={{ color: meta.color, fontWeight: 600 }}
                                    >
                                        {t.admin.inviteMembers.status[r.status]}
                                    </Typography>
                                </Stack>
                            );
                        })}
                    </Box>
                </Box>
            ) : (
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                    {emails.length > 0 && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
                            {emails.map((email) => (
                                <Chip
                                    key={`invite-chip-${email}`}
                                    color="primary"
                                    size="md"
                                    variant="soft"
                                    endDecorator={
                                        <CloseRoundedIcon
                                            sx={{ fontSize: 16, cursor: "pointer" }}
                                            onClick={() => removeChip(email)}
                                        />
                                    }
                                >
                                    {email}
                                </Chip>
                            ))}
                        </Box>
                    )}

                    <Input
                        placeholder={t.admin.inviteMembers.emailPlaceholder}
                        type="email"
                        value={draft}
                        slotProps={{
                            input: {
                                onKeyDown: (e) => {
                                    if (e.key === "Enter" || e.key === ",") {
                                        e.preventDefault();
                                        addChip(draft);
                                    } else if (
                                        e.key === "Backspace" &&
                                        draft === "" &&
                                        emails.length > 0
                                    ) {
                                        removeChip(emails[emails.length - 1]);
                                    }
                                },
                            },
                        }}
                        onBlur={() => addChip(draft)}
                        onChange={(e) => {
                            setDraft(e.target.value);
                            if (inputError) setInputError(null);
                        }}
                    />
                    <Typography level="body-xs" sx={{ color: g.text.tertiary, mt: 0.75 }}>
                        {t.admin.inviteMembers.addHint}
                    </Typography>

                    {inputError && (
                        <Typography level="body-xs" sx={{ color: g.warning.text, mt: 0.5 }}>
                            {inputError}
                        </Typography>
                    )}

                    {errorMessage && (
                        <Alert
                            color="danger"
                            startDecorator={<WarningAmberIcon />}
                            sx={{ mt: 1.5 }}
                        >
                            {errorMessage}
                        </Alert>
                    )}
                </Box>
            )}
        </ModalFrame>
    );
};
