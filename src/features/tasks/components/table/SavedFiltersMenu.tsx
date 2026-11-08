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
// The dropdown is a Joy `Menu` (via `FilterDropdown` / `FilterMenu`, shared with
// the six filter menus in `TaskFilterMenu`). It used to be a Material `Menu`
// that had to be given `slots={{ transition: Fade }}`, because a Material Menu
// without it crashed under the Joy theme alone (`Fade` -> `Backdrop` -> `Modal`
// read `theme.transitions.duration`); nothing here needs a Material theme now.

import { useCallback, useEffect, useRef, useState } from "react";
import BookmarksRoundedIcon from "@mui/icons-material/BookmarksRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import SaveAsRoundedIcon from "@mui/icons-material/SaveAsRounded";
import { Alert, Box, Button, IconButton, Input, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { EmptyState } from "../../../../components/ui/feedback/EmptyState";
import { SkeletonRows } from "../../../../components/ui/feedback/Skeleton";
import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { ModalFrame } from "../../../../components/ui/modal/ModalFrame";
import { TaskFilterMenuStyles } from "../../../../components/ui/styles/commonStyle";
import { useAuth } from "../../../../context/AuthContext";
import { fmt, useTranslation } from "../../../../i18n";
import {
    createProjectSavedFilter,
    deleteProjectSavedFilter,
    loadProjectSavedFilters,
    updateProjectSavedFilter,
    type ProjectSavedFilter,
    type SavedFilterPayload,
} from "../../services/projectSavedFilters";
import {
    FilterDropdown,
    FilterIconMenuButton,
    FilterMenu,
    FilterMenuItem,
} from "./filterBarParts";

// Accent for this control — teal, deliberately outside the palette the
// dimension filters use (status/tag colors, milestone orange, member
// indigo) so "recall a whole selection" doesn't read as "one more
// dimension to narrow by".
const SAVED_ACCENT = "#0d9488";
const SAVED_ACCENT_DARK = "#2dd4bf";

// Joy's IconButton has a 2rem minimum; these are small inline row actions.
const ICON_BUTTON_SX = { minWidth: 0, minHeight: 0, p: 0.25 } as const;

const NAME_MAX_LENGTH = 60; // matches ProjectSavedTaskFilter.filter_name

type DialogState =
    | { kind: "closed" }
    | { kind: "save" }
    // Rename targets one row; `name` seeds the input with the current one.
    | { kind: "rename"; id: number; name: string }
    // Delete targets one row too. The id is carried HERE rather than in a
    // separate "pending row" state so the confirm can only ever act on the row
    // whose button opened it — the menu lists every saved filter, and the
    // dialog is shared.
    | { kind: "delete"; id: number; name: string };

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

    const [menuOpen, setMenuOpen] = useState(false);
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

    const closeMenu = () => setMenuOpen(false);
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

    // Shared project-wide, so deleting takes it away from teammates too — worth
    // a confirm even though it destroys no task data.
    const openDeleteDialog = (row: ProjectSavedFilter) => {
        closeMenu();
        setDialogError(null);
        setDialog({ kind: "delete", id: row.id, name: row.filterName });
    };

    const handleSubmitDelete = async () => {
        if (!projectId || dialog.kind !== "delete") return;
        setIsSubmitting(true);
        setDialogError(null);
        const ok = await deleteProjectSavedFilter(projectId, dialog.id, accessToken);
        setIsSubmitting(false);
        if (!ok) {
            // Keep the dialog open on failure — the service fails soft, so
            // closing here would look like the delete had succeeded.
            setDialogError(ts.errorDeleteFailed);
            return;
        }
        closeDialog();
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
        <FilterDropdown open={menuOpen} onOpenChange={setMenuOpen}>
            <AppTooltip title={appliedName ? `${ts.button}: ${appliedName}` : ts.tooltip}>
                <FilterIconMenuButton
                    // AppTooltip writes its title onto the child as `aria-label`, so
                    // the accessible name is the tooltip sentence; the testid gives
                    // tests a stable handle without querying that sentence.
                    active={Boolean(appliedName)}
                    data-testid="saved-filters-button"
                    onClick={() => {
                        // Refetch on open. These rows are shared, so a
                        // filter a teammate just created would otherwise
                        // stay invisible until this component remounted —
                        // which undercuts the whole reason they live
                        // server-side. Opening the dropdown is the natural
                        // moment to be current; the previous list stays
                        // rendered while it lands, so there's no flash.
                        if (!menuOpen) void refresh();
                    }}
                >
                    <BookmarksRoundedIcon />
                </FilterIconMenuButton>
            </AppTooltip>

            <FilterMenu maxHeight="340px" minWidth="260px">
                {isLoading && saved.length === 0 && <SkeletonRows count={3} label={ts.loading} />}

                {!isLoading && saved.length === 0 && (
                    <EmptyState body={ts.empty} data-empty="saved-filters" size="sm" />
                )}

                {saved.map((row) => {
                    // Compare by id, not name: two rows could momentarily
                    // share a name mid-rename, and the id is what the
                    // derived match actually resolved to.
                    const isApplied = appliedRow?.id === row.id;
                    return (
                        <FilterMenuItem
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
                                            size="sm"
                                            sx={{ ...ICON_BUTTON_SX, color: styles.mutedText }}
                                            variant="plain"
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
                                            size="sm"
                                            sx={{ ...ICON_BUTTON_SX, color: styles.mutedText }}
                                            variant="plain"
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
                                            size="sm"
                                            variant="plain"
                                            sx={{
                                                ...ICON_BUTTON_SX,
                                                color: isDark ? "#f87171" : "#dc2626",
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openDeleteDialog(row);
                                            }}
                                        >
                                            <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                                        </IconButton>
                                    </AppTooltip>
                                </Stack>
                            </Box>
                        </FilterMenuItem>
                    );
                })}

                <Box
                    sx={{
                        borderTop: `1px solid ${styles.menuBorder}`,
                        mt: 0.5,
                        pt: 0.5,
                    }}
                >
                    <FilterMenuItem
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
                    </FilterMenuItem>
                </Box>
            </FilterMenu>

            {/* The name form (save / rename) is a ModalFrame; delete is the shared
                ConfirmDialog (destructive, busy while it runs). The three are mutually
                exclusive by construction (`dialog.kind`), so they share one close path and
                one `isSubmitting`. */}
            <ConfirmDialog
                busy={isSubmitting}
                cancelLabel={ts.cancel}
                confirmLabel={ts.deleteConfirm}
                error={dialogError}
                open={dialog.kind === "delete"}
                title={ts.deleteTitle}
                description={
                    dialog.kind === "delete" ? fmt(ts.deleteHelper, { name: dialog.name }) : ""
                }
                destructive
                onClose={closeDialog}
                onConfirm={() => void handleSubmitDelete()}
            />
            <ModalFrame
                description={dialog.kind === "rename" ? ts.renameHelper : ts.saveHelper}
                dismissible={!isSubmitting}
                open={dialog.kind === "save" || dialog.kind === "rename"}
                size="sm"
                title={dialog.kind === "rename" ? ts.renameTitle : ts.saveTitle}
                actions={
                    <>
                        <Button color="neutral" size="sm" variant="plain" onClick={closeDialog}>
                            {ts.cancel}
                        </Button>
                        <Button
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
                        </Button>
                    </>
                }
                onClose={closeDialog}
            >
                <Stack spacing={1.5}>
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
                    {/* Typing an existing name IS the overwrite gesture, so say so before
                        the click rather than refusing it after. */}
                    {willOverwrite && (
                        <Alert color="warning" size="sm" variant="soft">
                            {fmt(ts.overwriteWarning, { name: trimmedDraft })}
                        </Alert>
                    )}
                    {dialogError && (
                        <Alert color="danger" size="sm" variant="soft">
                            {dialogError}
                        </Alert>
                    )}
                </Stack>
            </ModalFrame>
        </FilterDropdown>
    );
};
