// Settings → Account: data export and account deletion (GDPR).
//
// Two deliberate UX rules, both because deletion is irreversible:
//   * the ownership blocker is shown BEFORE the user commits — the
//     server reports it on GET, so we never let someone type a
//     confirmation only to be refused;
//   * the confirm button stays disabled until the user types DELETE
//     AND (when the account has a password) supplies it. The server
//     enforces both independently — this is the courtesy, not the gate.

import { useEffect, useState } from "react";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    FormLabel,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";

import { useAuth } from "../../context/AuthContext";
import {
    AccountDeletionStatus,
    deleteAccount,
    downloadAccountExport,
    getAccountDeletionStatus,
} from "../../features/admin/services/accountLifecycle";
import { useSignOut } from "../../hooks/common/useSignOut";
import { useTranslation } from "../../i18n";

const CONFIRM_WORD = "DELETE";

export const AccountSettingsSection = () => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const signOut = useSignOut();
    const m = t.settings.account;

    const [status, setStatus] = useState<AccountDeletionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [typed, setTyped] = useState("");
    const [password, setPassword] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void getAccountDeletionStatus(accessToken).then((res) => {
            if (cancelled) return;
            setStatus(res);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [accessToken]);

    const handleExport = async () => {
        setExporting(true);
        setExportError(false);
        const ok = await downloadAccountExport(accessToken);
        setExporting(false);
        if (!ok) setExportError(true);
    };

    const canSubmit = typed === CONFIRM_WORD && (!status?.requiresPassword || password.length > 0);

    const handleDelete = async () => {
        setDeleting(true);
        setDeleteError(null);
        const result = await deleteAccount(accessToken, password);
        setDeleting(false);
        if (result.status === "deleted") {
            // The account is gone; the session is already dead
            // server-side (is_active=false), so clear it locally.
            await signOut();
            return;
        }
        if (result.status === "bad_password") setDeleteError(m.errorPassword);
        else if (result.status === "ownership_required") {
            setDeleteError(m.errorOwnership);
            setStatus((prev) =>
                prev ? { ...prev, canDelete: false, blockingTeams: result.teams } : prev
            );
            setConfirmOpen(false);
        } else setDeleteError(m.errorGeneric);
    };

    return (
        <Stack spacing={3}>
            {/* Export */}
            <Box>
                <Typography level="title-sm">{m.exportHeading}</Typography>
                <Typography level="body-xs" sx={{ mt: 0.5, mb: 1.5 }}>
                    {m.exportDescription}
                </Typography>
                <Button
                    loading={exporting}
                    size="sm"
                    startDecorator={<DownloadRoundedIcon />}
                    variant="soft"
                    onClick={handleExport}
                >
                    {m.exportButton}
                </Button>
                {exportError && (
                    <Alert color="danger" size="sm" sx={{ mt: 1.5 }}>
                        {m.errorGeneric}
                    </Alert>
                )}
            </Box>

            <Divider />

            {/* Deletion */}
            <Box>
                <Typography level="title-sm" sx={{ color: "danger.500" }}>
                    {m.deleteHeading}
                </Typography>
                <Typography level="body-xs" sx={{ mt: 0.5, mb: 1.5 }}>
                    {m.deleteDescription}
                </Typography>

                {loading ? (
                    <CircularProgress size="sm" />
                ) : (
                    <>
                        {status && !status.canDelete && (
                            <Alert color="warning" size="sm" sx={{ mb: 1.5 }}>
                                <Box>
                                    <Typography level="body-sm">{m.ownershipBlocked}</Typography>
                                    <Stack
                                        direction="row"
                                        spacing={0.5}
                                        sx={{ mt: 1, flexWrap: "wrap" }}
                                    >
                                        {status.blockingTeams.map((team) => (
                                            <Chip key={team.teamId} size="sm" variant="outlined">
                                                {team.teamName}
                                            </Chip>
                                        ))}
                                    </Stack>
                                </Box>
                            </Alert>
                        )}
                        <Button
                            color="danger"
                            disabled={!status?.canDelete}
                            size="sm"
                            startDecorator={<DeleteForeverRoundedIcon />}
                            variant="soft"
                            onClick={() => {
                                setTyped("");
                                setPassword("");
                                setDeleteError(null);
                                setConfirmOpen(true);
                            }}
                        >
                            {m.deleteButton}
                        </Button>
                    </>
                )}
            </Box>

            <Modal open={confirmOpen} onClose={() => !deleting && setConfirmOpen(false)}>
                <ModalDialog sx={{ maxWidth: 460 }} variant="outlined">
                    <Typography level="title-md" sx={{ color: "danger.500" }}>
                        {m.confirmHeading}
                    </Typography>
                    <Typography level="body-sm">{m.confirmBody}</Typography>
                    <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, my: 0.5 }}>
                        <Typography component="li" level="body-xs">
                            {m.confirmBullet1}
                        </Typography>
                        <Typography component="li" level="body-xs">
                            {m.confirmBullet2}
                        </Typography>
                        <Typography component="li" level="body-xs">
                            {m.confirmBullet3}
                        </Typography>
                    </Stack>

                    <FormControl sx={{ mt: 1 }}>
                        <FormLabel>{m.confirmTypeLabel}</FormLabel>
                        <Input
                            autoComplete="off"
                            placeholder={CONFIRM_WORD}
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                        />
                    </FormControl>

                    {status?.requiresPassword && (
                        <FormControl sx={{ mt: 1.5 }}>
                            <FormLabel>{m.confirmPasswordLabel}</FormLabel>
                            <Input
                                autoComplete="current-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </FormControl>
                    )}

                    {deleteError && (
                        <Alert color="danger" size="sm" sx={{ mt: 1.5 }}>
                            {deleteError}
                        </Alert>
                    )}

                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
                        <Button
                            disabled={deleting}
                            size="sm"
                            variant="plain"
                            onClick={() => setConfirmOpen(false)}
                        >
                            {m.cancel}
                        </Button>
                        <Button
                            color="danger"
                            disabled={!canSubmit}
                            loading={deleting}
                            size="sm"
                            onClick={handleDelete}
                        >
                            {m.confirmDeleteButton}
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </Stack>
    );
};
