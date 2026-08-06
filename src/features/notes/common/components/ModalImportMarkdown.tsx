import { useEffect, useMemo, useRef, useState } from "react";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import {
    Button,
    FormControl,
    FormLabel,
    Input,
    Modal,
    ModalDialog,
    Stack,
    Tab,
    TabList,
    Tabs,
    Typography,
} from "@mui/joy";
import Autocomplete, { createFilterOptions } from "@mui/joy/Autocomplete";

import { useOptionalAccessToken } from "../../../../context/AuthContext";
import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { resolveUploadLimitBytes } from "../../../../services/uploadLimit";
import { UserProps } from "../../../../types/admin";
import { MyNoteFolderProps } from "../../../../types/notes";
import {
    buildChatNoteDestinations,
    buildTaskNoteDestinations,
    chatDestinationKey,
    taskDestinationKey,
} from "../services/noteImportDestinations";
import { markdownToNoteBlocks, titleFromFilename } from "../services/noteMarkdown";
import type { ImportDestination } from "../services/runFolderImport";
import { FolderImportPanel } from "./FolderImportPanel";

/** Where the imported note gets created — mirrors the surface the ⋮ menu
 *  was opened from, and seeds the destination picker. */
export type ImportMarkdownContext =
    | { kind: "my"; folderId?: number | null }
    | { kind: "task"; projectId: number; taskId: number }
    | {
          kind: "chat";
          chatType: number;
          chatId: number;
          isThread: boolean;
          threadId: number;
      };

interface Props {
    open: boolean;
    onClose: () => void;
    context: ImportMarkdownContext;
    useNM: NoteManagementState;
    /** Owner of the created notes, and the uploader of record for any
     *  images a folder import brings over. */
    myself: UserProps;
    /** Lift above the UrlLinkModal when the header is modal-hosted —
     *  same convention as every other note-header dialog. */
    hostZIndex?: number;
    /** Show the destination picker (note headers, where "somewhere else"
     *  is a reasonable ask). Opened from a sidebar folder row the
     *  destination IS that folder, so the picker is suppressed and
     *  `context` is used verbatim. */
    allowDestinationChange?: boolean;
}

/** One searchable row in the destination picker. */
type DestinationOption = { key: string; label: string };

/** Value of the my-notes "unfiled" row. */
const MY_ROOT_KEY = "root";

// Flatten the folder forest into full-path rows ("Work › Clients › Acme"),
// name-sorted per level. Paths rather than the indentation ModalMoveToFolder
// uses, because these rows are SEARCHED: typing a parent folder's name has
// to surface everything under it.
const flattenFolders = (folders: MyNoteFolderProps[]): DestinationOption[] => {
    const byParent = new Map<number | null, MyNoteFolderProps[]>();
    for (const f of folders) {
        const key = f.parentFolderId ?? null;
        const bucket = byParent.get(key) ?? [];
        bucket.push(f);
        byParent.set(key, bucket);
    }
    const rows: DestinationOption[] = [];
    const walk = (parentId: number | null, prefix: string) => {
        const kids = [...(byParent.get(parentId) ?? [])].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        for (const f of kids) {
            const label = prefix ? `${prefix} › ${f.name}` : f.name;
            rows.push({ key: String(f.folderId), label });
            walk(f.folderId, label);
        }
    };
    walk(null, "");
    return rows;
};

// Cap the rendered rows — the popper has no virtualization, and a big
// workspace can have thousands of tasks. Typing narrows it; the cap only
// bites on an empty/very broad query.
const filterDestinations = createFilterOptions<DestinationOption>({
    limit: 100,
    stringify: (option) => option.label,
});

/**
 * "Import Markdown…" dialog: pick a local .md file, confirm the note
 * title (defaults to the file name) and — for my-notes — the destination
 * folder, then create a new note whose body is the parsed markdown.
 *
 * Creation goes through the existing `handleCreateNew*Note` orchestration
 * (with `opts.title` / `opts.body` overrides), so the new note opens in a
 * tab and lands in the sidebar exactly like a hand-created one.
 */
export const ModalImportMarkdown = ({
    open,
    onClose,
    context,
    useNM,
    myself,
    hostZIndex,
    allowDestinationChange = false,
}: Props) => {
    const { t } = useTranslation();
    // Optional rather than `useAuth`: this dialog is rendered from the
    // sidebar and three headers, and losing all of them to a missing
    // provider would be a poor trade for a mode that can simply not be
    // offered without a token.
    const accessToken = useOptionalAccessToken();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Only my-notes (personal and team alike) have folders to recreate a
    // tree in; a task or chat note has exactly one home.
    const canImportFolder = context.kind === "my" && accessToken != null;
    const [mode, setMode] = useState<"file" | "folder">("file");
    // Resolved once the folder tab is opened, so oversize images are
    // skipped locally instead of each one costing a 413.
    const [uploadLimitBytes, setUploadLimitBytes] = useState<number | null>(null);

    const [fileName, setFileName] = useState<string | null>(null);
    const [fileText, setFileText] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    // Selected destination as the picker's option key — a folder id (or
    // `root`) on my-notes, a task/chat anchor key elsewhere. Seeded from
    // `context` on open, so confirming without touching the picker
    // imports into the surface the dialog was opened from.
    const [destinationKey, setDestinationKey] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fresh state per open, seeded from `context`.
    //
    // `open` is the ONLY dependency on purpose. The note header mounts
    // this dialog continuously and rebuilds its `context` object literal
    // every render, so listing it here would re-run this reset on any
    // unrelated parent re-render — wiping the file and title the user had
    // already chosen, mid-dialog. The effect body still reads the current
    // context: React runs the latest render's callback when `open` flips.
    useEffect(() => {
        if (open) {
            setFileName(null);
            setFileText(null);
            setTitle("");
            setDestinationKey(
                context.kind === "task"
                    ? taskDestinationKey(context.projectId, context.taskId)
                    : context.kind === "chat"
                      ? chatDestinationKey(
                            context.chatType,
                            context.chatId,
                            context.isThread,
                            context.threadId
                        )
                      : context.folderId != null
                        ? String(context.folderId)
                        : MY_ROOT_KEY
            );
            setImporting(false);
            setError(null);
            setMode("file");
        }
    }, [open]);

    useEffect(() => {
        if (mode !== "folder") return;
        let live = true;
        void resolveUploadLimitBytes(accessToken).then((bytes) => {
            if (live) setUploadLimitBytes(bytes);
        });
        return () => {
            live = false;
        };
    }, [mode, accessToken]);

    // Task / chat destinations, keyed by their anchor. Only real tasks and
    // real chats can hold a note, so these lists carry no project or
    // chat-type root rows — see `noteImportDestinations`.
    const taskDestinations = useMemo(
        () => (context.kind === "task" ? buildTaskNoteDestinations(useNM.taskNoteMeta, t) : []),
        [context.kind, useNM.taskNoteMeta, t]
    );
    const chatDestinations = useMemo(
        () => (context.kind === "chat" ? buildChatNoteDestinations(useNM.chatNoteMeta, t) : []),
        [context.kind, useNM.chatNoteMeta, t]
    );

    // Rows for the picker. Only offered on the note-header path — opened
    // from a sidebar folder row the row IS the destination, for every
    // kind, so my-notes doesn't get a picker there either.
    const destinationOptions = useMemo<DestinationOption[]>(() => {
        if (!allowDestinationChange) return [];
        if (context.kind === "my") {
            return [
                { key: MY_ROOT_KEY, label: t.notes.importMd.rootFolder },
                ...flattenFolders(useNM.myNoteFolders),
            ];
        }
        return context.kind === "task" ? taskDestinations : chatDestinations;
    }, [
        allowDestinationChange,
        context.kind,
        useNM.myNoteFolders,
        taskDestinations,
        chatDestinations,
        t,
    ]);

    const selectedDestination = destinationOptions.find((o) => o.key === destinationKey) ?? null;

    // Which folder tree the import plants into. Personal and team folders
    // are different endpoints with different access rules, and the only
    // thing that distinguishes them here is whether the destination id
    // appears in the team list — the same test `handleCreateNewMyNote`
    // uses to decide which sidebar bucket a new note belongs to.
    const folderDestination = useMemo<ImportDestination>(() => {
        const folderId =
            destinationKey && destinationKey !== MY_ROOT_KEY ? Number(destinationKey) : null;
        const isTeam =
            folderId != null && useNM.teamNoteFolders.some((f) => f.folderId === folderId);
        return { kind: isTeam ? "team" : "personal", parentFolderId: folderId };
    }, [destinationKey, useNM.teamNoteFolders]);

    // The server is now the source of truth for a few hundred new rows,
    // and none of them went through the optimistic single-note path.
    const refreshAfterFolderImport = () => {
        if (folderDestination.kind === "team") {
            void useNM.getTeamNoteFolders();
            void useNM.getTeamNoteMeta();
        } else {
            void useNM.getMyNoteFolders();
            void useNM.getMyNoteMeta();
        }
    };

    const handleFilePicked = async (file: File) => {
        setError(null);
        try {
            const text = await file.text();
            setFileName(file.name);
            setFileText(text);
            // Default the note title to the file name; keep any name the
            // user already typed (they picked it deliberately).
            setTitle((prev) => prev || titleFromFilename(file.name));
        } catch {
            setError(t.notes.importMd.readError);
        }
    };

    const handleImport = async () => {
        if (fileText == null || !title.trim()) return;
        setImporting(true);
        setError(null);
        try {
            const body = await markdownToNoteBlocks(fileText);
            const opts = { title: title.trim(), body };
            if (context.kind === "my") {
                // `destinationKey` holds a folder id, or MY_ROOT_KEY for
                // unfiled. It was seeded from `context.folderId`, so an
                // untouched picker keeps the folder we were opened on.
                const folderId =
                    destinationKey && destinationKey !== MY_ROOT_KEY
                        ? Number(destinationKey)
                        : null;
                await useNM.handleCreateNewMyNote(null, folderId, opts);
            } else if (context.kind === "task") {
                // The picked destination when the user changed it, else
                // the surface this dialog was opened from.
                const picked = taskDestinations.find((d) => d.key === destinationKey);
                await useNM.handleCreateNewTaskNote(
                    null,
                    picked?.projectId ?? context.projectId,
                    picked?.taskId ?? context.taskId,
                    undefined,
                    opts
                );
            } else {
                const picked = chatDestinations.find((d) => d.key === destinationKey);
                await useNM.handleCreateNewChatNote(
                    null,
                    picked?.chatType ?? context.chatType,
                    picked?.chatId ?? context.chatId,
                    picked?.isThread ?? context.isThread,
                    picked?.threadId ?? context.threadId,
                    undefined,
                    opts
                );
            }
            onClose();
        } catch (e) {
            console.error("Markdown import failed:", e);
            setError(t.notes.importMd.importError);
        } finally {
            setImporting(false);
        }
    };

    return (
        <Modal
            open={open}
            sx={
                hostZIndex != null
                    ? {
                          zIndex: hostZIndex + 1,
                          // Joy pins Select/Autocomplete listbox popups to
                          // `calc(theme.zIndex.modal + 1)` (≈1301) and does
                          // NOT track the raised `zIndex` above — so inside
                          // the UrlLinkModal-hosted note header the
                          // destination dropdown would open BEHIND this
                          // dialog and be unclickable. Re-stamp the var on
                          // the modal root (inline listboxes inherit it) and
                          // on sibling portaled listboxes. Same fix as
                          // UrlLinkModal / SpotlightSettingsModal.
                          "--unstable_popup-zIndex": hostZIndex + 10,
                          '& ~ [role="listbox"]': {
                              "--unstable_popup-zIndex": hostZIndex + 10,
                          },
                      }
                    : undefined
            }
            onClose={onClose}
        >
            <ModalDialog sx={{ minWidth: 380, maxWidth: 480 }}>
                <Typography level="title-lg">{t.notes.importMd.heading}</Typography>

                {/* Folders only exist under my-notes, so a task or chat
                    note gets the single-file dialog it has always had. */}
                {canImportFolder && (
                    <Tabs
                        size="sm"
                        sx={{ bgcolor: "transparent", mt: 1 }}
                        value={mode}
                        onChange={(_e, v) => setMode(v as "file" | "folder")}
                    >
                        <TabList sx={{ borderRadius: "sm", p: 0.5 }} disableUnderline>
                            <Tab value="file" disableIndicator>
                                {t.notes.importMd.modeFile}
                            </Tab>
                            <Tab value="folder" disableIndicator>
                                {t.notes.importMd.modeFolder}
                            </Tab>
                        </TabList>
                    </Tabs>
                )}

                {/* Destination, type-to-search. Every option is a real
                    folder, task or chat — a note can't live on a
                    project or on a "DM" / "GM" bucket, so those rows
                    have no entry here. Clearing the field is ignored
                    (a note always lands somewhere): the previous pick
                    stays selected. Shared by both modes: a folder
                    import needs a destination just as much. */}
                {destinationOptions.length > 0 && (
                    <FormControl sx={{ mt: 2 }}>
                        <FormLabel>{t.notes.importMd.folderLabel}</FormLabel>
                        <Autocomplete
                            filterOptions={filterDestinations}
                            getOptionLabel={(option) => option.label}
                            isOptionEqualToValue={(option, value) => option.key === value.key}
                            options={destinationOptions}
                            value={selectedDestination}
                            autoHighlight
                            onChange={(_e, v) => {
                                if (v) setDestinationKey(v.key);
                            }}
                        />
                    </FormControl>
                )}

                {mode === "folder" && accessToken ? (
                    <FolderImportPanel
                        accessToken={accessToken}
                        destination={folderDestination}
                        myself={myself}
                        uploadLimitBytes={uploadLimitBytes}
                        onClose={onClose}
                        onImported={refreshAfterFolderImport}
                    />
                ) : (
                    <Stack spacing={2} sx={{ mt: 2 }}>
                        {error && (
                            <Typography level="body-sm" sx={{ color: "danger.500" }}>
                                {error}
                            </Typography>
                        )}

                        {/* Hidden native input; the button forwards the click.
                            .txt is accepted on purpose — plain text is valid
                            markdown and it saves a rename. */}
                        <input
                            ref={fileInputRef}
                            accept=".md,.markdown,.txt"
                            style={{ display: "none" }}
                            type="file"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleFilePicked(file);
                                // Allow re-picking the same file.
                                e.target.value = "";
                            }}
                        />
                        <Button
                            color="neutral"
                            startDecorator={<UploadFileRoundedIcon />}
                            variant="outlined"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {fileName ?? t.notes.importMd.chooseFile}
                        </Button>

                        <FormControl required>
                            <FormLabel>{t.notes.importMd.titleLabel}</FormLabel>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                        </FormControl>

                        <Stack direction="row" justifyContent="flex-end" spacing={1}>
                            <Button disabled={importing} variant="plain" onClick={onClose}>
                                {t.common.actions.cancel}
                            </Button>
                            <Button
                                disabled={importing || fileText == null || !title.trim()}
                                loading={importing}
                                onClick={handleImport}
                            >
                                {t.notes.importMd.importButton}
                            </Button>
                        </Stack>
                    </Stack>
                )}
            </ModalDialog>
        </Modal>
    );
};
