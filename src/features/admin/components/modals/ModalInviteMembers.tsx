import { useEffect, useState } from "react";
import { keyframes } from "@emotion/react";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Chip, Input, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useAuth } from "../../../../context/AuthContext";
import { ValidationUtils } from "../../../../db/utils/validation";
import { useTranslation } from "../../../../i18n";
import {
    InviteResult,
    InviteResultStatus,
    inviteTeamMembers,
} from "../../services/inviteTeamMembers";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

type Props = {
    open: boolean;
    teamId: string;
    onClose: () => void;
};

// Per-status icon + accent colour for the results list.
const STATUS_META: Record<InviteResultStatus, { color: string; Icon: typeof InfoRoundedIcon }> = {
    sent: { color: "rgba(74,222,128,0.9)", Icon: CheckCircleRoundedIcon },
    already_invited_resent: { color: "rgba(167,139,250,0.95)", Icon: MarkEmailReadRoundedIcon },
    already_member: { color: "rgba(255,255,255,0.6)", Icon: InfoRoundedIcon },
    invalid_email: { color: "rgba(251,191,36,0.95)", Icon: WarningAmberIcon },
    failed: { color: "rgba(232,121,195,0.95)", Icon: ErrorOutlineRoundedIcon },
};

export const ModalInviteMembers = ({ open, teamId, onClose }: Props) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

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
        const res = await inviteTeamMembers(accessToken, teamId, emails, setErrorMessage);
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
        <Modal
            open={open}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                // Transparent: Joy's own Backdrop slot already paints
                // `palette.background.backdrop` + blur(8px). Stacking a
                // second 50% black on the modal root composited to ~75%,
                // which read as a solid black page. Matches ModalUserProfile.
                backgroundColor: "transparent",
            }}
            onClose={handleClose}
        >
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.97) 0%, rgba(20, 20, 28, 0.99) 100%)",
                    border: "1px solid rgba(124,58,237,0.25)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(124,58,237,0.12)",
                    width: { xs: "calc(100vw - 24px)", md: "520px" },
                    minWidth: { xs: 0, md: "480px" },
                    maxWidth: "100vw",
                    p: { xs: 2, md: 3 },
                }}
            >
                <Box sx={{ textAlign: "center", mb: 2 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 56,
                            height: 56,
                            borderRadius: "14px",
                            background:
                                "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(139,92,246,0.15) 100%)",
                            border: "1px solid rgba(124,58,237,0.25)",
                            mx: "auto",
                            mb: 2,
                        }}
                    >
                        <PersonAddAltRoundedIcon
                            sx={{ color: "rgba(167,139,250,0.95)", fontSize: 28 }}
                        />
                    </Box>
                    <Typography
                        level="h4"
                        sx={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 600, mb: 1 }}
                    >
                        {t.admin.inviteMembers.title}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "rgba(255, 255, 255, 0.6)" }}>
                        {t.admin.inviteMembers.subtitle}
                    </Typography>
                </Box>

                {results ? (
                    <>
                        <Typography
                            level="title-sm"
                            sx={{ color: "rgba(255,255,255,0.8)", mb: 1 }}
                        >
                            {t.admin.inviteMembers.resultsTitle}
                        </Typography>
                        <Box
                            sx={{
                                maxHeight: 280,
                                overflow: "auto",
                                borderRadius: "10px",
                                border: "1px solid rgba(124,58,237,0.2)",
                                background: "rgba(0,0,0,0.15)",
                                p: 1,
                                mb: 2,
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
                                            sx={{
                                                color: "rgba(255,255,255,0.9)",
                                                flex: 1,
                                                minWidth: 0,
                                            }}
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
                        <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                            <Button
                                variant="plain"
                                sx={{
                                    color: "rgba(255, 255, 255, 0.7)",
                                    borderRadius: "10px",
                                    px: 3,
                                    "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.05)" },
                                }}
                                onClick={() => {
                                    setResults(null);
                                    setErrorMessage(null);
                                }}
                            >
                                {t.admin.inviteMembers.inviteMore}
                            </Button>
                            <Button
                                sx={{
                                    background:
                                        "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                    borderRadius: "10px",
                                    px: 3,
                                    fontWeight: 600,
                                }}
                                onClick={handleClose}
                            >
                                {t.admin.inviteMembers.done}
                            </Button>
                        </Stack>
                    </>
                ) : (
                    <>
                        {emails.length > 0 && (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
                                {emails.map((email) => (
                                    <Chip
                                        key={`invite-chip-${email}`}
                                        size="md"
                                        variant="soft"
                                        endDecorator={
                                            <CloseRoundedIcon
                                                sx={{ fontSize: 16, cursor: "pointer" }}
                                                onClick={() => removeChip(email)}
                                            />
                                        }
                                        sx={{
                                            background: "rgba(124,58,237,0.18)",
                                            color: "rgba(255,255,255,0.92)",
                                            border: "1px solid rgba(124,58,237,0.35)",
                                        }}
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
                            sx={{
                                "--Input-radius": "10px",
                                // The modal background is a fixed dark gradient in
                                // both themes, so force light text/placeholder —
                                // otherwise light-mode renders near-black text on
                                // the dark field.
                                "--Input-placeholderColor": "rgba(255,255,255,0.5)",
                                color: "rgba(255,255,255,0.92)",
                                background: "rgba(0,0,0,0.3)",
                                border: "1px solid rgba(124,58,237,0.25)",
                                fontSize: "14px",
                                "& input": { color: "rgba(255,255,255,0.92)" },
                            }}
                            onBlur={() => addChip(draft)}
                            onChange={(e) => {
                                setDraft(e.target.value);
                                if (inputError) setInputError(null);
                            }}
                        />
                        <Typography
                            level="body-xs"
                            sx={{ color: "rgba(255,255,255,0.5)", mt: 0.75 }}
                        >
                            {t.admin.inviteMembers.addHint}
                        </Typography>

                        {inputError && (
                            <Typography
                                level="body-xs"
                                sx={{ color: "rgba(251,191,36,0.95)", mt: 0.5 }}
                            >
                                {inputError}
                            </Typography>
                        )}

                        {errorMessage && (
                            <Alert
                                color="danger"
                                startDecorator={<WarningAmberIcon />}
                                sx={{
                                    mt: 1.5,
                                    borderRadius: "10px",
                                    backgroundColor: "rgba(232,121,195,0.1)",
                                    border: "1px solid rgba(232,121,195,0.3)",
                                }}
                            >
                                {errorMessage}
                            </Alert>
                        )}

                        <Stack
                            direction="row"
                            spacing={1.5}
                            sx={{ justifyContent: "flex-end", mt: 2.5 }}
                        >
                            <Button
                                disabled={submitting}
                                variant="plain"
                                sx={{
                                    color: "rgba(255, 255, 255, 0.6)",
                                    borderRadius: "10px",
                                    px: 3,
                                    "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.05)" },
                                }}
                                onClick={handleClose}
                            >
                                {t.admin.inviteMembers.cancel}
                            </Button>
                            <Button
                                disabled={emails.length === 0}
                                loading={submitting}
                                sx={{
                                    background:
                                        "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                    borderRadius: "10px",
                                    px: 3,
                                    fontWeight: 600,
                                }}
                                onClick={handleSend}
                            >
                                {submitting
                                    ? t.admin.inviteMembers.sending
                                    : t.admin.inviteMembers.send}
                            </Button>
                        </Stack>
                    </>
                )}
            </ModalDialog>
        </Modal>
    );
};
