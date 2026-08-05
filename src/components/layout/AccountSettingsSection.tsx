// Settings → Account: leaving a team, data export, account deletion (GDPR).
//
// The team list sits here because deletion is account-wide: it erases the
// user everywhere, and someone who only wants out of ONE of their teams
// used to have no way to discover that from this screen. Leaving lived on
// a team's own profile modal, so the only visible exit next to "belongs to
// two teams" was the irreversible one. The list is the reversible answer,
// placed above deletion and named in its copy.
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
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
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
    Sheet,
    Stack,
    Typography,
} from "@mui/joy";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import {
    AccountDeletionStatus,
    deleteAccount,
    downloadAccountExport,
    getAccountDeletionStatus,
} from "../../features/admin/services/accountLifecycle";
import { leaveTeam } from "../../features/admin/services/leaveTeam";
import { loadMyTeams } from "../../features/admin/services/loadMyTeams";
import { useSignOut } from "../../hooks/common/useSignOut";
import { useTranslation } from "../../i18n";
import { Team, UserProps } from "../../types/admin";
import { ModalLeaveConfirm } from "../ui/misc/ModalLeaveConfirm";

const CONFIRM_WORD = "DELETE";

type Props = {
    /** Absent when the modal is rendered without workspace context (the
     *  tab-rail test does this); the identifiers then come from
     *  localStorage, which the workspace bootstrap has already written. */
    myself?: UserProps;
    /** Close the surrounding Settings modal. Leaving the team you're
     *  currently in navigates away, and a modal left open over the
     *  team-picker would cover it. */
    onNavigateAway?: () => void;
};

export const AccountSettingsSection = ({ myself, onNavigateAway }: Props = {}) => {
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const signOut = useSignOut();
    const navigate = useNavigate();
    const m = t.settings.account;

    const userId = myself?.userId || localStorage.getItem("userId") || "";
    const activeTeamId = myself?.teamId || localStorage.getItem("teamId") || "";

    const [status, setStatus] = useState<AccountDeletionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [typed, setTyped] = useState("");
    const [password, setPassword] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [teamsLoading, setTeamsLoading] = useState(true);
    const [leaveTarget, setLeaveTarget] = useState<Team | null>(null);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            if (!userId) {
                setTeamsLoading(false);
                return;
            }
            try {
                const loaded: Team[] = (await loadMyTeams(accessToken, userId)) ?? [];
                // Guest shells are teams the user only reaches through a
                // share or as a project guest — there is no membership to
                // give up, and the server refuses a leave. Listing them
                // would offer an exit that doesn't exist.
                if (!cancelled) setTeams(loaded.filter((team) => !team.isGuest));
            } catch {
                // Non-fatal: the section then shows the empty line, and
                // the per-team profile still has its own Leave button.
            } finally {
                if (!cancelled) setTeamsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accessToken, userId]);

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

    const handleLeave = async (team: Team) => {
        const ok = await leaveTeam(accessToken, team.teamId, userId);
        if (!ok) return false;
        setLeaveTarget(null);
        if (team.teamId === activeTeamId) {
            // Same exit as the team profile's own Leave: /jointeam reads
            // teamId/teamName fresh, so clearing them is what forces a
            // clean re-entry instead of the workspace rendering a team
            // this user is no longer in.
            localStorage.removeItem("teamId");
            localStorage.removeItem("teamName");
            onNavigateAway?.();
            navigate("/jointeam");
            return true;
        }
        setTeams((prev) => prev.filter((entry) => entry.teamId !== team.teamId));
        return true;
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

            {/* Teams — the reversible way out, deliberately above deletion */}
            <Box>
                <Typography level="title-sm">{m.teamsHeading}</Typography>
                <Typography level="body-xs" sx={{ mt: 0.5, mb: 1.5 }}>
                    {m.teamsDescription}
                </Typography>
                {teamsLoading ? (
                    <CircularProgress size="sm" />
                ) : teams.length === 0 ? (
                    <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                        {m.teamsEmpty}
                    </Typography>
                ) : (
                    <Stack spacing={0.5}>
                        {teams.map((team) => {
                            // Owners are refused server-side, so the button
                            // is replaced by the reason rather than shown
                            // and then failing.
                            const isOwner = team.teamOwnerId === userId;
                            return (
                                <Sheet
                                    key={team.teamId}
                                    variant="soft"
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        flexWrap: "wrap",
                                        minHeight: 44,
                                        px: 1.5,
                                        py: 0.75,
                                        borderRadius: "md",
                                    }}
                                >
                                    <Typography level="body-sm" sx={{ minWidth: 0 }}>
                                        {team.teamName}
                                    </Typography>
                                    {team.teamId === activeTeamId && (
                                        <Chip color="primary" size="sm" variant="soft">
                                            {m.teamsCurrent}
                                        </Chip>
                                    )}
                                    <Box sx={{ flex: 1 }} />
                                    {isOwner ? (
                                        <Typography level="body-xs" sx={{ opacity: 0.7 }}>
                                            {m.teamsOwnerHint}
                                        </Typography>
                                    ) : (
                                        <Button
                                            color="danger"
                                            size="sm"
                                            startDecorator={<LogoutRoundedIcon />}
                                            variant="plain"
                                            onClick={() => setLeaveTarget(team)}
                                        >
                                            {t.common.actions.leave}
                                        </Button>
                                    )}
                                </Sheet>
                            );
                        })}
                    </Stack>
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

            <ModalLeaveConfirm
                description={t.common.leaveConfirm.teamDescription}
                entityName={leaveTarget?.teamName ?? ""}
                open={leaveTarget !== null}
                title={t.common.leaveConfirm.teamTitle}
                onCancel={() => setLeaveTarget(null)}
                onConfirm={() => (leaveTarget ? handleLeave(leaveTarget) : Promise.resolve(false))}
            />

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
