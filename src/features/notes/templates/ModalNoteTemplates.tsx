import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { PartialBlock } from "@blocknote/core";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import {
    Box,
    Button,
    FormControl,
    FormLabel,
    IconButton,
    Input,
    Option,
    Select,
    Stack,
    Textarea,
    Typography,
} from "@mui/joy";
import { useTheme } from "@mui/joy/styles";

import { useNoteModalHostZIndex } from "../../../components/modals/noteModalHostZIndex";
import { AppTooltip } from "../../../components/ui/AppTooltip";
import { ModalFrame } from "../../../components/ui/modal/ModalFrame";
import { useAuth } from "../../../context/authState";
import { fmt, useTranslation } from "../../../i18n";
import type { UserProps } from "../../../types/admin";
import type { TeamNoteFolderProps } from "../../../types/notes";
import { markdownToNoteBlocks, noteBlocksToMarkdown } from "../common/services/noteMarkdown";
import { NoteTemplatePreview } from "./NoteTemplatePreview";
import { buildNoteTemplate, NOTE_TEMPLATE_IDS } from "./noteTemplates";
import {
    deleteTeamNoteTemplate,
    loadTeamNoteTemplate,
    saveTeamNoteTemplate,
    type NoteTemplateScope,
    type TeamNoteTemplate,
} from "./teamNoteTemplates";
import type { TemplatePick } from "./templateMenuItems";

const NO_FOLDER = "none";

type Props = {
    open: boolean;
    myself: UserProps;
    // Team and personal templates (the list endpoint sends both); the built-ins are added here.
    templates: TeamNoteTemplate[];
    // Only the team's own folders can hold a default (the server refuses the rest).
    folders: TeamNoteFolderProps[];
    onClose: () => void;
    // Use the chosen template: the caller creates the note and closes this.
    onUse: (pick: TemplatePick) => void;
    // A template or a folder default changed: reload the list and the folder rows.
    onChanged: () => void;
};

type Draft = {
    templateId?: number;
    scope: NoteTemplateScope;
    name: string;
    title: string;
    markdown: string;
    folder: string;
    // The folder the template had when the form opened: a save that leaves it alone does not
    // send it, so renaming never needs Editor on the folder.
    originalFolder: string;
};

const EMPTY: Draft = {
    scope: "personal",
    name: "",
    title: "",
    markdown: "",
    folder: NO_FOLDER,
    originalFolder: NO_FOLDER,
};

type Group = "builtin" | "team" | "personal";
type Entry = {
    key: string;
    group: Group;
    name: string;
    pick: TemplatePick;
    // Built-ins carry their blocks and title; the others are read on demand.
    builtin?: { title: string; blocks: PartialBlock[] };
    tpl?: TeamNoteTemplate;
};

const GROUPS: Group[] = ["builtin", "team", "personal"];
const optionId = (key: string) => `note-tpl-option-${key.replace(/[^a-z0-9]/gi, "-")}`;

/**
 * "New note from template…" (MIP-2337): the one place to choose, preview, add, edit and delete
 * note templates. On the left the list (built-in, team, mine); on the right a read-only preview
 * of the selected one; below, "Use this template". Arrow keys move through the list, Enter uses
 * the template, Esc closes. The body is written as Markdown and stored as BlockNote blocks, the
 * way an imported note is. Only the creator (or, on the server, the team owner) can change or
 * delete a template; a refusal shows as "could not save".
 */
export const ModalNoteTemplates = ({
    open,
    myself,
    templates,
    folders,
    onClose,
    onUse,
    onChanged,
}: Props) => {
    const { t } = useTranslation();
    const all = t.notes.noteTemplates;
    const copy = all.team;
    const { accessToken } = useAuth();
    const hostZIndex = useNoteModalHostZIndex();
    const theme = useTheme();
    const [draft, setDraft] = useState<Draft | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    // Template bodies read on demand (the list leaves them out). `failed` = could not read.
    const [bodies, setBodies] = useState<Record<number, PartialBlock[] | "failed">>({});

    useEffect(() => {
        if (open) {
            setDraft(null);
            setError(null);
            setConfirmDelete(null);
            setBodies({});
        }
    }, [open]);

    const entries = useMemo<Entry[]>(() => {
        const builtin: Entry[] = NOTE_TEMPLATE_IDS.map((id) => ({
            key: `builtin:${id}`,
            group: "builtin",
            name: all[id].label,
            pick: { kind: "builtin", id },
            builtin: buildNoteTemplate(id, all),
        }));
        const fromServer = (group: Group, rows: TeamNoteTemplate[]): Entry[] =>
            rows.map((tpl) => ({
                key: `tpl:${tpl.templateId}`,
                group,
                name: tpl.name,
                pick: { kind: "team", templateId: tpl.templateId },
                tpl,
            }));
        return [
            ...builtin,
            ...fromServer(
                "team",
                templates.filter((x) => x.scope !== "personal")
            ),
            ...fromServer(
                "personal",
                templates.filter((x) => x.scope === "personal")
            ),
        ];
    }, [all, templates]);

    const selected = entries.find((e) => e.key === selectedKey) ?? entries[0];

    // Read the selected template's body once.
    const selectedTpl = selected?.tpl;
    const selectedId = selectedTpl?.templateId;
    const haveBody = selectedId != null && bodies[selectedId] !== undefined;
    useEffect(() => {
        if (!open || selectedId == null || haveBody) return;
        let alive = true;
        void loadTeamNoteTemplate(myself, selectedId, accessToken).then((full) => {
            if (!alive) return;
            setBodies((prev) => ({ ...prev, [selectedId]: full ? (full.body ?? []) : "failed" }));
        });
        return () => {
            alive = false;
        };
    }, [open, selectedId, haveBody, myself, accessToken]);

    // Own folders only, and only where the person can edit (Owner 1 / Editor 2): the server
    // refuses a default on any other. A folder already chosen stays listed.
    const ownFolders = folders.filter((f) => f.isExternal !== true);
    const pickable = ownFolders.filter(
        (f) => f.myRoleId <= 2 || String(f.folderId) === draft?.folder
    );
    const folderName = (id: number | null) =>
        id == null ? null : (ownFolders.find((f) => f.folderId === id)?.name ?? null);

    const canChange = (e: Entry | undefined) =>
        !!e?.tpl &&
        (e.tpl.scope === "personal" || String(e.tpl.createdBy) === String(myself.userId));

    const edit = async (tpl: TeamNoteTemplate) => {
        setError(null);
        setBusy(true);
        const full = await loadTeamNoteTemplate(myself, tpl.templateId, accessToken);
        setBusy(false);
        if (!full) {
            setError(copy.saveFailed);
            return;
        }
        const folder = full.defaultFolderId == null ? NO_FOLDER : String(full.defaultFolderId);
        setDraft({
            templateId: tpl.templateId,
            scope: tpl.scope === "personal" ? "personal" : "team",
            name: full.name,
            title: full.title,
            markdown: await noteBlocksToMarkdown(full.body ?? []),
            folder,
            originalFolder: folder,
        });
    };

    const remove = async (tpl: TeamNoteTemplate) => {
        setError(null);
        setBusy(true);
        const ok = await deleteTeamNoteTemplate(myself, tpl.templateId, accessToken);
        setBusy(false);
        setConfirmDelete(null);
        if (ok) onChanged();
        else setError(copy.deleteFailed);
    };

    const save = async () => {
        if (!draft || !draft.name.trim()) return;
        setBusy(true);
        setError(null);
        const saved = await saveTeamNoteTemplate(
            myself,
            {
                templateId: draft.templateId,
                ...(draft.templateId === undefined ? { scope: draft.scope } : {}),
                name: draft.name.trim(),
                title: draft.title,
                body: await markdownToNoteBlocks(draft.markdown),
                ...(draft.scope === "team" && draft.folder !== draft.originalFolder
                    ? { defaultFolderId: draft.folder === NO_FOLDER ? null : Number(draft.folder) }
                    : {}),
            },
            accessToken
        );
        setBusy(false);
        if (!saved) {
            setError(copy.saveFailed);
            return;
        }
        setBodies((prev) => {
            const next = { ...prev };
            delete next[saved.templateId];
            return next;
        });
        setSelectedKey(`tpl:${saved.templateId}`);
        setDraft(null);
        onChanged();
    };

    const move = (delta: number) => {
        if (entries.length === 0) return;
        const i = Math.max(
            0,
            entries.findIndex((e) => e.key === selected?.key)
        );
        const next = entries[Math.min(entries.length - 1, Math.max(0, i + delta))];
        setSelectedKey(next.key);
        setConfirmDelete(null);
        document.getElementById(optionId(next.key))?.scrollIntoView?.({ block: "nearest" });
    };

    const onListKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
        } else if (e.key === "Home") {
            e.preventDefault();
            move(-entries.length);
        } else if (e.key === "End") {
            e.preventDefault();
            move(entries.length);
        } else if (e.key === "Enter" && selected) {
            e.preventDefault();
            onUse(selected.pick);
        }
    };

    const groupLabel: Record<Group, string> = {
        builtin: copy.groupBuiltin,
        team: copy.groupTeam,
        personal: copy.groupPersonal,
    };

    const body = selectedId != null ? bodies[selectedId] : undefined;
    const previewBlocks: PartialBlock[] | null = selected?.builtin
        ? selected.builtin.blocks
        : Array.isArray(body)
          ? body
          : null;
    const previewTitle = selected?.builtin?.title ?? selectedTpl?.title ?? "";
    const defaultFolder = selectedTpl ? folderName(selectedTpl.defaultFolderId) : null;

    return (
        <ModalFrame
            description={draft ? undefined : copy.pickerHint}
            fillBody={!draft}
            hostZIndex={hostZIndex}
            open={open}
            size={draft ? "md" : "wide"}
            zIndex={theme.zIndex.modal}
            actions={
                draft ? (
                    <>
                        <Button color="neutral" variant="plain" onClick={() => setDraft(null)}>
                            {t.notes.folders.cancel}
                        </Button>
                        <Button
                            disabled={busy || !draft.name.trim()}
                            loading={busy}
                            onClick={() => void save()}
                        >
                            {t.notes.folders.save}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            startDecorator={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                            variant="soft"
                            onClick={() => setDraft(EMPTY)}
                        >
                            {copy.newTemplate}
                        </Button>
                        <Button
                            disabled={!selected}
                            onClick={() => selected && onUse(selected.pick)}
                        >
                            {copy.use}
                        </Button>
                    </>
                )
            }
            title={
                draft
                    ? draft.templateId
                        ? copy.editTemplate
                        : copy.newTemplate
                    : copy.pickerTitle
            }
            fullScreenOnMobile
            ownsListboxPopups
            onClose={onClose}
        >
            {draft ? (
                <Stack spacing={1.5}>
                    {draft.templateId === undefined && (
                        <FormControl>
                            <FormLabel>{copy.scope}</FormLabel>
                            <Select
                                value={draft.scope}
                                onChange={(_, v) =>
                                    setDraft({
                                        ...draft,
                                        scope: v ?? "personal",
                                        folder: NO_FOLDER,
                                    })
                                }
                            >
                                <Option value="personal">{copy.scopePersonal}</Option>
                                <Option value="team">{copy.scopeTeam}</Option>
                            </Select>
                        </FormControl>
                    )}
                    <FormControl>
                        <FormLabel>{copy.name}</FormLabel>
                        <Input
                            slotProps={{ input: { maxLength: 100 } }}
                            value={draft.name}
                            autoFocus
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                    </FormControl>
                    <FormControl>
                        <FormLabel>{copy.noteTitle}</FormLabel>
                        <Input
                            slotProps={{ input: { maxLength: 255 } }}
                            value={draft.title}
                            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                        />
                    </FormControl>
                    {draft.scope === "team" && (
                        <FormControl>
                            <FormLabel>{copy.defaultFolder}</FormLabel>
                            <Select
                                value={draft.folder}
                                onChange={(_, v) => setDraft({ ...draft, folder: v ?? NO_FOLDER })}
                            >
                                <Option value={NO_FOLDER}>{copy.noDefault}</Option>
                                {pickable.map((f) => (
                                    <Option key={f.folderId} value={String(f.folderId)}>
                                        {f.name}
                                    </Option>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                    <FormControl>
                        <FormLabel>{copy.body}</FormLabel>
                        <Textarea
                            maxRows={14}
                            minRows={8}
                            value={draft.markdown}
                            onChange={(e) => setDraft({ ...draft, markdown: e.target.value })}
                        />
                    </FormControl>
                    {error && (
                        <Typography color="danger" level="body-xs" role="alert">
                            {error}
                        </Typography>
                    )}
                </Stack>
            ) : (
                <Box
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        height: { md: 440 },
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", md: "232px minmax(0, 1fr)" },
                        gridTemplateRows: { xs: "minmax(112px, 34%) minmax(0, 1fr)", md: "1fr" },
                        gap: 2,
                    }}
                >
                    <Box
                        aria-activedescendant={selected ? optionId(selected.key) : undefined}
                        aria-label={copy.listLabel}
                        role="listbox"
                        tabIndex={0}
                        sx={{
                            overflowY: "auto",
                            minHeight: 0,
                            borderRadius: "md",
                            border: "1px solid",
                            borderColor: "divider",
                            p: 0.5,
                            outline: "none",
                            "&:focus-visible": {
                                outline: "2px solid",
                                outlineColor: "primary.500",
                                outlineOffset: 1,
                            },
                        }}
                        onKeyDown={onListKeyDown}
                    >
                        {GROUPS.map((g) => {
                            const rows = entries.filter((e) => e.group === g);
                            return (
                                <Box key={g} aria-label={groupLabel[g]} role="group">
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            px: 1,
                                            pt: 1,
                                            pb: 0.5,
                                            opacity: 0.6,
                                            textTransform: "uppercase",
                                            letterSpacing: 0.4,
                                        }}
                                    >
                                        {groupLabel[g]}
                                    </Typography>
                                    {rows.length === 0 && (
                                        <Typography
                                            level="body-xs"
                                            sx={{ px: 1, py: 0.5, opacity: 0.6 }}
                                        >
                                            {g === "team" ? copy.empty : copy.emptyPersonal}
                                        </Typography>
                                    )}
                                    {rows.map((e) => {
                                        const on = e.key === selected?.key;
                                        return (
                                            <Box
                                                key={e.key}
                                                aria-selected={on}
                                                id={optionId(e.key)}
                                                role="option"
                                                sx={{
                                                    px: 1,
                                                    minHeight: 36,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    borderRadius: "sm",
                                                    cursor: "pointer",
                                                    bgcolor: on
                                                        ? "background.level2"
                                                        : "transparent",
                                                    "&:hover": { bgcolor: "background.level1" },
                                                }}
                                                onDoubleClick={() => onUse(e.pick)}
                                                onClick={() => {
                                                    setSelectedKey(e.key);
                                                    setConfirmDelete(null);
                                                }}
                                            >
                                                <Typography
                                                    level="body-sm"
                                                    sx={{ fontWeight: on ? 600 : 400 }}
                                                    noWrap
                                                >
                                                    {e.name}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            );
                        })}
                    </Box>
                    <Stack spacing={1} sx={{ minHeight: 0, minWidth: 0 }}>
                        {selected && (
                            <>
                                <Stack alignItems="center" direction="row" spacing={1}>
                                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography level="title-md" noWrap>
                                            {selected.name}
                                        </Typography>
                                        <Typography level="body-xs" sx={{ opacity: 0.6 }} noWrap>
                                            {defaultFolder
                                                ? fmt(copy.defaultIn, { folder: defaultFolder })
                                                : groupLabel[selected.group]}
                                        </Typography>
                                    </Stack>
                                    {canChange(selected) &&
                                        selectedTpl &&
                                        confirmDelete !== selectedTpl.templateId && (
                                            <>
                                                <AppTooltip
                                                    size="sm"
                                                    title={t.notes.folders.rename}
                                                >
                                                    <IconButton
                                                        aria-label={`${t.notes.folders.rename}: ${selected.name}`}
                                                        disabled={busy}
                                                        size="sm"
                                                        variant="plain"
                                                        onClick={() => void edit(selectedTpl)}
                                                    >
                                                        <DriveFileRenameOutlineRoundedIcon
                                                            sx={{ fontSize: 16 }}
                                                        />
                                                    </IconButton>
                                                </AppTooltip>
                                                <AppTooltip
                                                    size="sm"
                                                    title={t.notes.folders.delete}
                                                >
                                                    <IconButton
                                                        aria-label={`${t.notes.folders.delete}: ${selected.name}`}
                                                        color="danger"
                                                        disabled={busy}
                                                        size="sm"
                                                        variant="plain"
                                                        onClick={() =>
                                                            setConfirmDelete(
                                                                selectedTpl.templateId
                                                            )
                                                        }
                                                    >
                                                        <DeleteOutlineRoundedIcon
                                                            sx={{ fontSize: 16 }}
                                                        />
                                                    </IconButton>
                                                </AppTooltip>
                                            </>
                                        )}
                                </Stack>
                                {selectedTpl && confirmDelete === selectedTpl.templateId && (
                                    <Stack
                                        alignItems="center"
                                        direction="row"
                                        role="alert"
                                        spacing={1}
                                    >
                                        <Typography level="body-sm" sx={{ flex: 1 }}>
                                            {fmt(copy.deleteConfirm, { name: selected.name })}
                                        </Typography>
                                        <Button
                                            color="neutral"
                                            size="sm"
                                            variant="plain"
                                            onClick={() => setConfirmDelete(null)}
                                        >
                                            {t.notes.folders.cancel}
                                        </Button>
                                        <Button
                                            color="danger"
                                            loading={busy}
                                            size="sm"
                                            onClick={() => void remove(selectedTpl)}
                                        >
                                            {t.notes.folders.delete}
                                        </Button>
                                    </Stack>
                                )}
                                {previewTitle && (
                                    <Typography level="body-xs" noWrap>
                                        <Box component="span" sx={{ opacity: 0.6 }}>
                                            {copy.noteTitle}:{" "}
                                        </Box>
                                        {previewTitle}
                                    </Typography>
                                )}
                                <Box
                                    aria-label={fmt(copy.previewLabel, { name: selected.name })}
                                    role="region"
                                    sx={{
                                        flex: 1,
                                        minHeight: 0,
                                        overflowY: "auto",
                                        borderRadius: "md",
                                        border: "1px solid",
                                        borderColor: "divider",
                                        p: 1,
                                    }}
                                >
                                    {previewBlocks ? (
                                        <NoteTemplatePreview
                                            key={selected.key}
                                            blocks={previewBlocks}
                                        />
                                    ) : body === "failed" ? (
                                        <Typography color="danger" level="body-sm" role="alert">
                                            {copy.previewFailed}
                                        </Typography>
                                    ) : (
                                        <Typography level="body-sm" sx={{ opacity: 0.6 }}>
                                            {copy.previewLoading}
                                        </Typography>
                                    )}
                                </Box>
                            </>
                        )}
                        {error && (
                            <Typography color="danger" level="body-xs" role="alert">
                                {error}
                            </Typography>
                        )}
                    </Stack>
                </Box>
            )}
        </ModalFrame>
    );
};
