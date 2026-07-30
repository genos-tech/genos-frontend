// "Saved Filters" — the named, project-shared filter selections that sit
// at the right end of the task filter bar.
//
// Why it exists: the bar narrows on six dimensions, and users want
// several DIFFERENT combinations depending on what they're checking ("my
// blocked work", "this sprint's review queue", "unassigned P1s").
// Re-picking each by hand every time is the problem; a named selection
// makes recall one click.
//
// Rows are project-scoped server-side, so a filter one member saves shows
// up for every other member of the project. That's distinct from the
// existing localStorage persistence, which remembers only "what was I
// last looking at" for one browser.
//
// Lives in its own file rather than inside `TaskFilterMenu` — that file
// is already ~2.8k lines, and everything here is self-contained: it owns
// its CRUD, its menu and its dialogs, and talks to the bar through two
// callbacks (read the current selection, apply a saved one).
//
// LOAD-BEARING: the dropdown is a MUI **Material** `Menu` with
// `slots={{ transition: Fade }}`, matching all six sibling filter menus
// in `TaskFilterMenu`. The Fade slot is not decoration — a Material Menu
// without it crashes in this Joy-themed app (`Fade` → `Backdrop` →
// `Modal` reads `theme.transitions.duration`, undefined under the Joy
// theme) and the Tasks error boundary swallows the whole feature. The
// dialogs below are Joy `Modal`/`ModalDialog` for the same reason — a
// Material `Dialog` has the same backdrop path.

import { useCallback, useEffect, useRef, useState } from "react";
import BookmarkAddedRoundedIcon from "@mui/icons-material/BookmarkAddedRounded";
import BookmarksRoundedIcon from "@mui/icons-material/BookmarksRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import SaveAsRoundedIcon from "@mui/icons-material/SaveAsRounded";
import {
    Alert,
    Input,
    Box as JoyBox,
    Button as JoyButton,
    Stack as JoyStack,
    Typography as JoyTypography,
    Modal,
    ModalDialog,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import Button from "@mui/material/Button";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { alpha } from "@mui/system";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { TaskFilterMenuStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { useTranslation } from "../../../../i18n";
import {
    createProjectSavedFilter,
    deleteProjectSavedFilter,
    loadProjectSavedFilters,
    updateProjectSavedFilter,
    type ProjectSavedFilter,
    type SavedFilterPayload,
} from "../../services/projectSavedFilters";

// Accent for this control — teal, deliberately outside the palette the
// dimension filters use (status/tag colors, milestone orange, member
// indigo) so "recall a whole selection" doesn't read as "one more
// dimension to narrow by".
const SAVED_ACCENT = "#0d9488";
const SAVED_ACCENT_DARK = "#2dd4bf";

const NAME_MAX_LENGTH = 60; // matches ProjectSavedTaskFilter.filter_name

type DialogState =
    | { kind: "closed" }
    | { kind: "save" }
    // Rename targets one row; `name` seeds the input with the current one.
    | { kind: "rename"; id: number; name: string };

type SavedFiltersMenuProps = {
    teamId: string | null | undefined;
    projectId: number | null | undefined;
    /** Reads the bar's CURRENT selection at click time. A getter rather
     *  than a value prop so this component never re-renders on every
     *  filter toggle — it only needs the selection at the moment the user
     *  presses Save. */
    getCurrentFilters: () => SavedFilterPayload;
    /** Applies a saved selection to the bar. The bar owns the six state
     *  setters AND has to re-run its filter pipeline explicitly, so this
     *  is one call rather than six setters. */
    onApply: (filters: SavedFilterPayload) => void;
    /** "Would applying this produce the selection currently in effect?"
     *
     *  The bar answers, because it owns both the live selection and the
     *  predefined lists a stored blob resolves against. Asked per row on
     *  every render, so the applied state is DERIVED rather than
     *  remembered — editing a dimension after applying a filter drops the
     *  badge, and hand-building a matching selection lights it up. */
    isCurrentSelection: (filters: SavedFilterPayload) => boolean;
};

export const SavedFiltersMenu = ({
    teamId,
    projectId,
    getCurrentFilters,
    onApply,
    isCurrentSelection,
}: SavedFiltersMenuProps) => {
    const { accessToken } = useAuth();
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? TaskFilterMenuStyles.dark : TaskFilterMenuStyles.light;
    const { t } = useTranslation();
    const ts = t.tasks.savedFilters;
    const accent = isDark ? SAVED_ACCENT_DARK : SAVED_ACCENT;

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [saved, setSaved] = useState<ProjectSavedFilter[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
    const [nameDraft, setNameDraft] = useState("");
    const [dialogError, setDialogError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Which saved filter is in effect — DERIVED from the bar's live
    // selection every render, never stored.
    //
    // This started as an `appliedName` state set on click, and that was
    // wrong in both directions: it kept claiming "f1" after the user
    // edited a dimension on top of it, and it stayed blank when someone
    // hand-built a selection that already existed as a saved filter.
    // Deriving fixes both, and removes a whole class of staleness (it also
    // can't survive a project switch or a token refresh, which the stored
    // version had to be taught about separately).
    //
    // First match wins if two filters hold the same conditions — the list
    // is name-ordered server-side, so that's at least deterministic.
    const appliedRow = saved.find((row) => isCurrentSelection(row.filters));
    const appliedName = appliedRow?.filterName ?? null;

    // Race guard: a project switch mid-fetch must not land the previous
    // project's filters in this menu.
    const fetchTokenRef = useRef(0);

    const refresh = useCallback(async () => {
        if (!teamId || !projectId) {
            setSaved([]);
            return;
        }
        const token = ++fetchTokenRef.current;
        setIsLoading(true);
        const rows = await loadProjectSavedFilters(teamId, projectId, accessToken);
        if (token !== fetchTokenRef.current) return;
        setSaved(rows ?? []);
        setIsLoading(false);
    }, [teamId, projectId, accessToken]);

    // Load on mount, and whenever the fetch inputs change.
    useEffect(() => {
        void refresh();
    }, [refresh]);

    const closeMenu = () => setAnchorEl(null);
    const closeDialog = () => {
        setDialog({ kind: "closed" });
        setNameDraft("");
        setDialogError(null);
    };

    const openSaveDialog = () => {
        closeMenu();
        // Opens EMPTY, even when a saved filter is applied. Seeding it
        // with `appliedName` looked convenient but pre-armed an overwrite:
        // the badge doesn't clear when the user then edits a dimension by
        // hand, so "apply a filter → tweak it → Save" would open already
        // pointed at Overwrite and replace a teammate-visible filter with
        // an unrelated selection. Overwriting a specific filter is its own
        // explicit gesture — the Save-As icon on that filter's row.
        setNameDraft("");
        setDialogError(null);
        setDialog({ kind: "save" });
    };

    const openRenameDialog = (row: ProjectSavedFilter) => {
        closeMenu();
        setNameDraft(row.filterName);
        setDialogError(null);
        setDialog({ kind: "rename", id: row.id, name: row.filterName });
    };

    const handleApply = (row: ProjectSavedFilter) => {
        closeMenu();
        // No badge bookkeeping: applying changes the bar's selection, and
        // the badge is derived from that.
        onApply(row.filters);
    };

    // Save = create, OR overwrite when the typed name already exists.
    //
    // The server's unique (project, name) constraint makes a same-name
    // POST a 400, so the collision is resolved HERE into a PUT. That is
    // also exactly the "overridable with the same name" gesture: type the
    // existing name and the current selection replaces it.
    const handleSubmitSave = async () => {
        if (!teamId || !projectId) return;
        const name = nameDraft.trim();
        if (!name) {
            setDialogError(ts.errorNameRequired);
            return;
        }
        setIsSubmitting(true);
        setDialogError(null);
        const filters = getCurrentFilters();
        const existing = saved.find((f) => f.filterName.toLowerCase() === name.toLowerCase());
        const result = existing
            ? await updateProjectSavedFilter(projectId, existing.id, { filters }, accessToken)
            : await createProjectSavedFilter(teamId, projectId, name, filters, accessToken);
        setIsSubmitting(false);
        if (!result) {
            setDialogError(ts.errorSaveFailed);
            return;
        }
        closeDialog();
        void refresh();
    };

    const handleSubmitRename = async () => {
        if (!projectId || dialog.kind !== "rename") return;
        const name = nameDraft.trim();
        if (!name) {
            setDialogError(ts.errorNameRequired);
            return;
        }
        if (name === dialog.name) {
            closeDialog();
            return;
        }
        // A rename onto another filter's name is a 400 from the unique
        // constraint. Catch it here so the user gets the real reason
        // instead of a generic failure.
        const clash = saved.some(
            (f) => f.id !== dialog.id && f.filterName.toLowerCase() === name.toLowerCase()
        );
        if (clash) {
            setDialogError(ts.errorNameTaken);
            return;
        }
        setIsSubmitting(true);
        setDialogError(null);
        const result = await updateProjectSavedFilter(
            projectId,
            dialog.id,
            { filterName: name },
            accessToken
        );
        setIsSubmitting(false);
        if (!result) {
            setDialogError(ts.errorSaveFailed);
            return;
        }
        closeDialog();
        void refresh();
    };

    const handleDelete = async (row: ProjectSavedFilter) => {
        if (!projectId) return;
        // Shared project-wide, so deleting takes it away from teammates
        // too — worth a confirm even though it destroys no task data.
        if (!window.confirm(ts.confirmDelete.replace("{name}", row.filterName))) return;
        const ok = await deleteProjectSavedFilter(projectId, row.id, accessToken);
        if (!ok) return;
        void refresh();
    };

    // No project resolved yet (or no team) → nothing to scope filters to.
    if (!teamId || !projectId) return null;

    const trimmedDraft = nameDraft.trim();
    const willOverwrite =
        dialog.kind === "save" &&
        trimmedDraft.length > 0 &&
        saved.some((f) => f.filterName.toLowerCase() === trimmedDraft.toLowerCase());

    return (
        <>
            <AppTooltip title={ts.tooltip}>
                <Button
                    // AppTooltip writes its title onto the child as
                    // `aria-label`, so this button's accessible name is the
                    // tooltip sentence rather than its visible text — true
                    // of every tooltip-wrapped button in this bar. The
                    // testid gives tests a stable handle without querying
                    // that sentence.
                    data-testid="saved-filters-button"
                    variant="outlined"
                    endIcon={
                        appliedName ? undefined : (
                            <BookmarksRoundedIcon sx={{ fontSize: "14px" }} />
                        )
                    }
                    startIcon={
                        appliedName ? (
                            <BookmarkAddedRoundedIcon sx={{ fontSize: "16px" }} />
                        ) : undefined
                    }
                    sx={{
                        // Filled while a saved filter is applied, quiet
                        // otherwise — same "active vs idle" grammar the
                        // milestone/member buttons use.
                        color: appliedName ? "#fff" : accent,
                        background: appliedName
                            ? isDark
                                ? `linear-gradient(135deg, ${alpha(SAVED_ACCENT_DARK, 0.5)} 0%, ${alpha(SAVED_ACCENT_DARK, 0.7)} 100%)`
                                : `linear-gradient(135deg, ${alpha(SAVED_ACCENT, 0.75)} 0%, ${alpha(SAVED_ACCENT, 0.95)} 100%)`
                            : isDark
                              ? alpha(SAVED_ACCENT_DARK, 0.12)
                              : alpha(SAVED_ACCENT, 0.08),
                        border: `1px solid ${alpha(accent, isDark ? 0.45 : 0.4)}`,
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        height: "32px",
                        whiteSpace: "nowrap",
                        maxWidth: "220px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        px: 1.5,
                        my: 0.5,
                        textTransform: "none",
                        flexShrink: 0,
                        transition: "all 0.2s ease",
                        "&:hover": {
                            background: appliedName
                                ? isDark
                                    ? `linear-gradient(135deg, ${alpha(SAVED_ACCENT_DARK, 0.6)} 0%, ${alpha(SAVED_ACCENT_DARK, 0.8)} 100%)`
                                    : `linear-gradient(135deg, ${alpha(SAVED_ACCENT, 0.85)} 0%, ${alpha(SAVED_ACCENT, 1)} 100%)`
                                : isDark
                                  ? alpha(SAVED_ACCENT_DARK, 0.2)
                                  : alpha(SAVED_ACCENT, 0.16),
                            transform: "translateY(-1px)",
                        },
                    }}
                    onClick={(event) => {
                        setAnchorEl(event.currentTarget);
                        // Refetch on open. These rows are shared, so a
                        // filter a teammate just created would otherwise
                        // stay invisible until this component remounted —
                        // which undercuts the whole reason they live
                        // server-side. Opening the dropdown is the natural
                        // moment to be current; the previous list stays
                        // rendered while it lands, so there's no flash.
                        void refresh();
                    }}
                >
                    {appliedName ?? ts.button}
                </Button>
            </AppTooltip>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                slots={{ transition: Fade }}
                slotProps={{
                    paper: {
                        className: `custom-scrollbar-${isDark ? "dark" : "light"}`,
                        sx: {
                            background: styles.menuBg,
                            border: `1px solid ${styles.menuBorder}`,
                            borderRadius: "12px",
                            boxShadow: isDark
                                ? "0 8px 32px rgba(0,0,0,0.5)"
                                : "0 8px 32px rgba(0,0,0,0.15)",
                            mt: 1,
                            minWidth: "260px",
                            maxHeight: "340px",
                        },
                    },
                }}
                onClose={closeMenu}
            >
                {isLoading && saved.length === 0 && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.5 }}>
                        <CircularProgress size={14} sx={{ color: accent }} />
                        <Typography sx={{ fontSize: "12px", color: styles.mutedText }}>
                            {ts.loading}
                        </Typography>
                    </Box>
                )}

                {!isLoading && saved.length === 0 && (
                    <Box sx={{ px: 2, py: 1.5, maxWidth: 260 }}>
                        <Typography sx={{ fontSize: "12px", color: styles.mutedText }}>
                            {ts.empty}
                        </Typography>
                    </Box>
                )}

                {saved.map((row) => {
                    // Compare by id, not name: two rows could momentarily
                    // share a name mid-rename, and the id is what the
                    // derived match actually resolved to.
                    const isApplied = appliedRow?.id === row.id;
                    return (
                        <MenuItem
                            key={row.id}
                            // The applied row is emphasised with weight and
                            // color; `aria-current` carries the same fact to
                            // screen readers, which can't see either.
                            aria-current={isApplied ? "true" : undefined}
                            sx={{
                                borderRadius: "8px",
                                mx: 0.5,
                                my: 0.25,
                                gap: 1,
                                transition: "all 0.2s ease",
                                "&:hover": { background: styles.buttonHoverBg },
                                // Row actions sit at a low opacity and come
                                // up to full on hover — always present,
                                // never hidden.
                                //
                                // They used to be `opacity: 0` revealed by
                                // `:hover, :focus-within`, which broke: a
                                // Material Menu auto-focuses its FIRST item
                                // on open, so `:focus-within` matched row 1
                                // permanently and only that row showed its
                                // icons. Gating on `:hover` alone would fix
                                // the symptom but leave the actions
                                // undiscoverable and unreachable by touch —
                                // a recurring problem in this app — so
                                // always-visible-faint is the better answer
                                // than a smarter focus selector.
                                "&:hover .saved-filter-actions": { opacity: 1 },
                            }}
                            onClick={() => handleApply(row)}
                        >
                            <Box
                                sx={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    minWidth: 0,
                                }}
                            >
                                <BookmarksRoundedIcon
                                    sx={{
                                        fontSize: 14,
                                        color: isApplied ? accent : styles.mutedText,
                                        flexShrink: 0,
                                    }}
                                />
                                <Typography
                                    sx={{
                                        fontSize: "13px",
                                        fontWeight: isApplied ? 700 : 500,
                                        color: isApplied ? accent : styles.textColor,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        flex: 1,
                                        minWidth: 0,
                                    }}
                                >
                                    {row.filterName}
                                </Typography>
                                <Stack
                                    alignItems="center"
                                    className="saved-filter-actions"
                                    direction="row"
                                    spacing={0.25}
                                    sx={{
                                        // Faint but always there and always
                                        // clickable — see the row's sx.
                                        opacity: 0.45,
                                        transition: "opacity 0.15s ease",
                                        flexShrink: 0,
                                    }}
                                >
                                    <AppTooltip title={ts.overwriteTooltip}>
                                        <IconButton
                                            size="small"
                                            sx={{ color: styles.mutedText, p: 0.25 }}
                                            onClick={(e) => {
                                                // Every action here must stop
                                                // propagation: the row itself
                                                // applies the filter, and a
                                                // bubbled click would apply it
                                                // as a side effect of pressing
                                                // rename or delete.
                                                e.stopPropagation();
                                                closeMenu();
                                                setNameDraft(row.filterName);
                                                setDialogError(null);
                                                setDialog({ kind: "save" });
                                            }}
                                        >
                                            <SaveAsRoundedIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                    </AppTooltip>
                                    <AppTooltip title={ts.renameTooltip}>
                                        <IconButton
                                            size="small"
                                            sx={{ color: styles.mutedText, p: 0.25 }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openRenameDialog(row);
                                            }}
                                        >
                                            <DriveFileRenameOutlineRoundedIcon
                                                sx={{ fontSize: 15 }}
                                            />
                                        </IconButton>
                                    </AppTooltip>
                                    <AppTooltip title={ts.deleteTooltip}>
                                        <IconButton
                                            size="small"
                                            sx={{
                                                color: isDark ? "#f87171" : "#dc2626",
                                                p: 0.25,
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void handleDelete(row);
                                            }}
                                        >
                                            <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                    </AppTooltip>
                                </Stack>
                            </Box>
                        </MenuItem>
                    );
                })}

                <Box
                    sx={{
                        borderTop: `1px solid ${styles.menuBorder}`,
                        mt: 0.5,
                        pt: 0.5,
                    }}
                >
                    <MenuItem
                        sx={{
                            borderRadius: "8px",
                            mx: 0.5,
                            my: 0.25,
                            gap: 1,
                            "&:hover": { background: styles.buttonHoverBg },
                        }}
                        onClick={openSaveDialog}
                    >
                        <SaveAsRoundedIcon sx={{ fontSize: 15, color: accent }} />
                        <Typography sx={{ fontSize: "13px", fontWeight: 600, color: accent }}>
                            {ts.saveCurrent}
                        </Typography>
                    </MenuItem>
                </Box>
            </Menu>

            {/* Joy Modal, not a Material Dialog — see the file header note
                on the Joy theme and the Material backdrop. */}
            <Modal open={dialog.kind !== "closed"} onClose={closeDialog}>
                <ModalDialog sx={{ minWidth: 340, maxWidth: 420, borderRadius: "lg" }}>
                    <JoyTypography level="title-md">
                        {dialog.kind === "rename" ? ts.renameTitle : ts.saveTitle}
                    </JoyTypography>
                    <JoyTypography level="body-xs" sx={{ mb: 0.5 }}>
                        {dialog.kind === "rename" ? ts.renameHelper : ts.saveHelper}
                    </JoyTypography>
                    <JoyStack spacing={1.5}>
                        <Input
                            placeholder={ts.namePlaceholder}
                            size="sm"
                            slotProps={{ input: { maxLength: NAME_MAX_LENGTH } }}
                            value={nameDraft}
                            autoFocus
                            onChange={(e) => {
                                setNameDraft(e.target.value);
                                setDialogError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key !== "Enter" || isSubmitting) return;
                                e.preventDefault();
                                void (dialog.kind === "rename"
                                    ? handleSubmitRename()
                                    : handleSubmitSave());
                            }}
                        />
                        {/* Typing an existing name IS the overwrite
                            gesture, so say so before the click rather
                            than refusing it after. */}
                        {willOverwrite && (
                            <Alert color="warning" size="sm" variant="soft">
                                {ts.overwriteWarning.replace("{name}", trimmedDraft)}
                            </Alert>
                        )}
                        {dialogError && (
                            <Alert color="danger" size="sm" variant="soft">
                                {dialogError}
                            </Alert>
                        )}
                        <JoyBox
                            sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 0.5 }}
                        >
                            <JoyButton
                                color="neutral"
                                size="sm"
                                variant="plain"
                                onClick={closeDialog}
                            >
                                {ts.cancel}
                            </JoyButton>
                            <JoyButton
                                disabled={isSubmitting || trimmedDraft.length === 0}
                                size="sm"
                                variant="solid"
                                onClick={() =>
                                    void (dialog.kind === "rename"
                                        ? handleSubmitRename()
                                        : handleSubmitSave())
                                }
                            >
                                {dialog.kind === "rename"
                                    ? ts.renameConfirm
                                    : willOverwrite
                                      ? ts.overwriteConfirm
                                      : ts.saveConfirm}
                            </JoyButton>
                        </JoyBox>
                    </JoyStack>
                </ModalDialog>
            </Modal>
        </>
    );
};
