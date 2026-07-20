import { useCallback, useEffect, useState } from "react";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    IconButton,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { PROFILE_MODAL_Z_INDEX } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../i18n";
import { ProjectLabelProps } from "../../../../types/tasks";
import { ColorPickerMenu } from "../../../tasks/components/contents/base/sub/TagColorPickerMenu";
import {
    assignProjectLabels,
    createProjectLabel,
    deleteProjectLabel,
    loadTeamProjectLabels,
    updateProjectLabel,
} from "../../services/projectLabels";

const DEFAULT_COLOR = "#8e23ff";
const DEFAULT_TEXT_COLOR = "white";

type ModalManageProjectLabelsProps = {
    open: boolean;
    onClose: () => void;
    teamId: string;
    projectId: number;
    /** Labels currently on this project, as last known by the host modal. */
    assignedLabels: ProjectLabelProps[];
    /** Push the project's new label set back to the host so its chips re-render. */
    onAssignedChange: (labels: ProjectLabelProps[]) => void;
};

/**
 * Owner-only management of the team's PROJECT-label catalog, plus which
 * of those labels apply to the current project.
 *
 * Two distinct jobs in one list, because they share the same rows:
 *   • the CHECKBOX assigns/unassigns the label on THIS project;
 *   • the pencil / trash edit the TEAM-WIDE catalog entry, which every
 *     other project carrying it sees too. The per-row project count
 *     makes that blast radius visible before the user commits.
 *
 * The host only mounts this for the project owner, and the backend
 * re-checks ownership on every write, so nothing here is gated again.
 */
export const ModalManageProjectLabels = ({
    open,
    onClose,
    teamId,
    projectId,
    assignedLabels,
    onAssignedChange,
}: ModalManageProjectLabelsProps) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    const [catalog, setCatalog] = useState<ProjectLabelProps[]>([]);
    const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState({
        color: DEFAULT_COLOR,
        textColor: DEFAULT_TEXT_COLOR,
    });

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState({
        color: DEFAULT_COLOR,
        textColor: DEFAULT_TEXT_COLOR,
    });
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const refreshCatalog = useCallback(async () => {
        setLoading(true);
        const labels = await loadTeamProjectLabels(teamId, accessToken);
        setCatalog(labels);
        setLoading(false);
    }, [teamId, accessToken]);

    // Load on open only, and reset the transient row state so a reopen
    // never lands mid-edit or mid-delete-confirm.
    useEffect(() => {
        if (!open) {
            setEditingId(null);
            setConfirmDeleteId(null);
            setErrorMessage(null);
            setNewName("");
            return;
        }
        setAssignedIds(new Set(assignedLabels.map((l) => l.labelId)));
        void refreshCatalog();
        // `assignedLabels` is intentionally not a dep: it changes identity
        // on every assignment write below, which would re-seed the set
        // mid-interaction and re-fetch the catalog for no reason.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, refreshCatalog]);

    /**
     * Persist a whole label set for this project. The API takes the full
     * desired set (not a delta), so toggling is just "compute the next
     * set, send it". Optimistic with a revert: the checkbox has to feel
     * instant, but a 403/network failure must not leave the UI claiming
     * a label is attached when it isn't.
     */
    const persistAssignment = async (nextIds: Set<number>) => {
        const previous = assignedIds;
        setAssignedIds(nextIds);
        setBusy(true);
        setErrorMessage(null);
        const res = await assignProjectLabels(projectId, [...nextIds], accessToken);
        setBusy(false);
        if (!res.ok) {
            setAssignedIds(previous);
            setErrorMessage(res.error ?? t.admin.projectLabels.assignFailed);
            return;
        }
        // Render from the server's answer, not our guess — it has
        // already dropped any id it refused (e.g. another team's label).
        setAssignedIds(new Set(res.labels.map((l) => l.labelId)));
        onAssignedChange(res.labels);
        void refreshCatalog(); // project counts moved
    };

    const toggleAssigned = (labelId: number) => {
        const next = new Set(assignedIds);
        if (next.has(labelId)) next.delete(labelId);
        else next.add(labelId);
        void persistAssignment(next);
    };

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name) return;
        setBusy(true);
        setErrorMessage(null);
        const res = await createProjectLabel(
            projectId,
            name,
            newColor.color,
            newColor.textColor,
            accessToken
        );
        setBusy(false);
        if (!res.ok) {
            setErrorMessage(res.error);
            return;
        }
        setNewName("");
        setNewColor({ color: DEFAULT_COLOR, textColor: DEFAULT_TEXT_COLOR });
        // A new label starts unassigned — attaching it to the project the
        // user created it from is the obviously-intended next step, so do
        // it in the same gesture rather than making them tick the box.
        const next = new Set(assignedIds);
        next.add(res.label.labelId);
        await persistAssignment(next);
    };

    const startEdit = (label: ProjectLabelProps) => {
        setEditingId(label.labelId);
        setEditName(label.name);
        setEditColor({ color: label.color, textColor: label.textColor });
        setConfirmDeleteId(null);
        setErrorMessage(null);
    };

    const handleSaveEdit = async (labelId: number) => {
        const name = editName.trim();
        if (!name) return;
        setBusy(true);
        setErrorMessage(null);
        const res = await updateProjectLabel(
            projectId,
            labelId,
            { name, color: editColor.color, textColor: editColor.textColor },
            accessToken
        );
        setBusy(false);
        if (!res.ok) {
            setErrorMessage(res.error);
            return;
        }
        setEditingId(null);
        setCatalog((prev) =>
            prev.map((l) => (l.labelId === labelId ? { ...l, ...res.label } : l))
        );
        // A rename/recolor changes how this project's own chips read, so
        // the host needs the new values too.
        if (assignedIds.has(labelId)) {
            onAssignedChange(
                [...catalog.filter((l) => assignedIds.has(l.labelId))].map((l) =>
                    l.labelId === labelId ? { ...l, ...res.label } : l
                )
            );
        }
    };

    const handleDelete = async (labelId: number) => {
        setBusy(true);
        setErrorMessage(null);
        const res = await deleteProjectLabel(projectId, labelId, accessToken);
        setBusy(false);
        if (!res.ok) {
            setErrorMessage(res.error ?? t.admin.projectLabels.deleteFailed);
            return;
        }
        setConfirmDeleteId(null);
        setCatalog((prev) => prev.filter((l) => l.labelId !== labelId));
        if (assignedIds.has(labelId)) {
            const next = new Set(assignedIds);
            next.delete(labelId);
            setAssignedIds(next);
            onAssignedChange(catalog.filter((l) => next.has(l.labelId)));
        }
    };

    const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const rowBg = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)";
    const subtleText = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";

    return (
        <Modal
            open={open}
            sx={{
                // One above the profile modal that launches us — a
                // hardcoded page-level default would open BEHIND it.
                zIndex: PROFILE_MODAL_Z_INDEX + 1,
                backdropFilter: "blur(4px)",
                // Joy's ModalDialog already paints its own Backdrop;
                // a second layer here composites to near-solid black.
                backgroundColor: "transparent",
            }}
            onClose={onClose}
        >
            <ModalDialog
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    borderRadius: "16px",
                    border: `1px solid ${border}`,
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "480px" },
                    maxWidth: { xs: "100vw", md: "620px" },
                    maxHeight: { xs: "calc(100dvh - 32px)", md: "80vh" },
                    p: { xs: 2, md: 3 },
                    overflow: "auto",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                    <LocalOfferIcon sx={{ fontSize: 22, color: "#8b5cf6" }} />
                    <Typography level="h4" sx={{ fontWeight: 600, flex: 1 }}>
                        {t.admin.projectLabels.manageHeading}
                    </Typography>
                    <IconButton size="sm" variant="plain" onClick={onClose}>
                        <CloseRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>

                <Typography level="body-xs" sx={{ color: subtleText, mb: 2 }}>
                    {t.admin.projectLabels.manageDescription}
                </Typography>

                {errorMessage && (
                    <Alert color="danger" sx={{ mb: 2, borderRadius: "10px" }}>
                        {errorMessage}
                    </Alert>
                )}

                {/* Create row */}
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={1}
                    sx={{
                        mb: 2,
                        p: 1,
                        borderRadius: "10px",
                        border: `1px solid ${border}`,
                        background: rowBg,
                    }}
                >
                    <Chip
                        size="sm"
                        variant="solid"
                        sx={{
                            backgroundColor: newColor.color,
                            color: newColor.textColor,
                            borderRadius: "5px",
                            fontWeight: 600,
                            flexShrink: 0,
                            maxWidth: 140,
                        }}
                    >
                        {newName.trim() || t.admin.projectLabels.newLabelPreview}
                    </Chip>
                    <Input
                        placeholder={t.admin.projectLabels.newLabelPlaceholder}
                        size="sm"
                        sx={{ flex: 1, "--Input-radius": "8px" }}
                        value={newName}
                        slotProps={{
                            input: {
                                maxLength: 30,
                                onKeyDown: (e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        void handleCreate();
                                    }
                                },
                            },
                        }}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    <ColorPickerMenu
                        onSelectColor={(c) =>
                            setNewColor({ color: c.value, textColor: c.textColor })
                        }
                    />
                    <Button
                        disabled={busy || newName.trim().length === 0}
                        size="sm"
                        startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                        sx={{ borderRadius: "8px", flexShrink: 0 }}
                        onClick={handleCreate}
                    >
                        {t.admin.projectLabels.add}
                    </Button>
                </Stack>

                {/* Catalog list — checkbox = assign to this project,
                    pencil/trash = edit the team-wide entry. */}
                <Stack
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    spacing={0.5}
                    sx={{ overflowY: "auto", maxHeight: "45vh", pr: 0.5 }}
                >
                    {loading && (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                            <CircularProgress size="sm" />
                        </Box>
                    )}

                    {!loading && catalog.length === 0 && (
                        <Typography
                            level="body-sm"
                            sx={{ color: subtleText, textAlign: "center", py: 3 }}
                        >
                            {t.admin.projectLabels.empty}
                        </Typography>
                    )}

                    {!loading &&
                        catalog.map((label) => {
                            const isEditing = editingId === label.labelId;
                            const isConfirmingDelete = confirmDeleteId === label.labelId;
                            return (
                                <Box
                                    key={label.labelId}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        p: 1,
                                        borderRadius: "10px",
                                        border: `1px solid ${border}`,
                                        background: rowBg,
                                    }}
                                >
                                    {isEditing ? (
                                        <>
                                            <Chip
                                                size="sm"
                                                variant="solid"
                                                sx={{
                                                    backgroundColor: editColor.color,
                                                    color: editColor.textColor,
                                                    borderRadius: "5px",
                                                    fontWeight: 600,
                                                    flexShrink: 0,
                                                    maxWidth: 120,
                                                }}
                                            >
                                                {editName.trim() || label.name}
                                            </Chip>
                                            <Input
                                                size="sm"
                                                sx={{ flex: 1, "--Input-radius": "8px" }}
                                                value={editName}
                                                slotProps={{
                                                    input: {
                                                        maxLength: 30,
                                                        onKeyDown: (e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                void handleSaveEdit(label.labelId);
                                                            }
                                                            if (e.key === "Escape") {
                                                                setEditingId(null);
                                                            }
                                                        },
                                                    },
                                                }}
                                                autoFocus
                                                onChange={(e) => setEditName(e.target.value)}
                                            />
                                            <ColorPickerMenu
                                                onSelectColor={(c) =>
                                                    setEditColor({
                                                        color: c.value,
                                                        textColor: c.textColor,
                                                    })
                                                }
                                            />
                                            <Button
                                                disabled={busy}
                                                size="sm"
                                                sx={{ borderRadius: "8px" }}
                                                onClick={() => handleSaveEdit(label.labelId)}
                                            >
                                                {t.common.profileEdit.save}
                                            </Button>
                                            <Button
                                                color="neutral"
                                                size="sm"
                                                variant="plain"
                                                onClick={() => setEditingId(null)}
                                            >
                                                {t.common.profileEdit.cancel}
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Checkbox
                                                checked={assignedIds.has(label.labelId)}
                                                disabled={busy}
                                                size="sm"
                                                sx={{ flexShrink: 0 }}
                                                onChange={() => toggleAssigned(label.labelId)}
                                            />
                                            <Chip
                                                size="sm"
                                                variant="solid"
                                                sx={{
                                                    backgroundColor: label.color,
                                                    color: label.textColor,
                                                    borderRadius: "5px",
                                                    fontWeight: 600,
                                                    flexShrink: 0,
                                                    maxWidth: 180,
                                                }}
                                            >
                                                {label.name}
                                            </Chip>
                                            <Typography
                                                level="body-xs"
                                                sx={{ color: subtleText, flex: 1, minWidth: 0 }}
                                                noWrap
                                            >
                                                {fmt(t.admin.projectLabels.usedByProjects, {
                                                    count: label.projectCount ?? 0,
                                                })}
                                            </Typography>

                                            {isConfirmingDelete ? (
                                                <>
                                                    {/* The count above is the blast radius: a
                                                        delete detaches the label from EVERY
                                                        project using it, not just this one. */}
                                                    <Typography
                                                        level="body-xs"
                                                        sx={{ color: "#ef4444" }}
                                                    >
                                                        {t.admin.projectLabels.deleteConfirm}
                                                    </Typography>
                                                    <Button
                                                        color="danger"
                                                        disabled={busy}
                                                        size="sm"
                                                        sx={{ borderRadius: "8px" }}
                                                        onClick={() => handleDelete(label.labelId)}
                                                    >
                                                        {t.common.actions.delete}
                                                    </Button>
                                                    <Button
                                                        color="neutral"
                                                        size="sm"
                                                        variant="plain"
                                                        onClick={() => setConfirmDeleteId(null)}
                                                    >
                                                        {t.common.profileEdit.cancel}
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <AppTooltip
                                                        size="sm"
                                                        title={t.admin.projectLabels.editLabel}
                                                    >
                                                        <IconButton
                                                            size="sm"
                                                            variant="plain"
                                                            onClick={() => startEdit(label)}
                                                        >
                                                            <EditRoundedIcon
                                                                sx={{ fontSize: 16 }}
                                                            />
                                                        </IconButton>
                                                    </AppTooltip>
                                                    <AppTooltip
                                                        size="sm"
                                                        title={t.admin.projectLabels.deleteLabel}
                                                    >
                                                        <IconButton
                                                            color="danger"
                                                            size="sm"
                                                            variant="plain"
                                                            onClick={() =>
                                                                setConfirmDeleteId(label.labelId)
                                                            }
                                                        >
                                                            <DeleteOutlineRoundedIcon
                                                                sx={{ fontSize: 16 }}
                                                            />
                                                        </IconButton>
                                                    </AppTooltip>
                                                </>
                                            )}
                                        </>
                                    )}
                                </Box>
                            );
                        })}
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
