import { useEffect, useMemo, useRef, useState } from "react";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import {
    Button,
    FormControl,
    FormLabel,
    Input,
    Modal,
    ModalDialog,
    Option,
    Select,
    Stack,
    Typography,
} from "@mui/joy";

import { NoteManagementState } from "../../../../hooks/notes/useNoteManagement";
import { useTranslation } from "../../../../i18n";
import { MyNoteFolderProps } from "../../../../types/notes";
import {
    buildChatNoteDestinations,
    buildTaskNoteDestinations,
    chatDestinationKey,
    taskDestinationKey,
} from "../services/noteImportDestinations";
import { markdownToNoteBlocks, titleFromFilename } from "../services/noteMarkdown";

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
    /** Lift above the UrlLinkModal when the header is modal-hosted —
     *  same convention as every other note-header dialog. */
    hostZIndex?: number;
    /** Show the destination picker (note headers, where "somewhere else"
     *  is a reasonable ask). Opened from a sidebar folder row the
     *  destination IS that folder, so the picker is suppressed and
     *  `context` is used verbatim. */
    allowDestinationChange?: boolean;
}

// Flatten the folder list into indented select rows (name-sorted per
// level) — same presentation as ModalMoveToFolder's list.
type FolderRow = { folderId: number; label: string; depth: number };
const flattenFolders = (folders: MyNoteFolderProps[]): FolderRow[] => {
    const byParent = new Map<number | null, MyNoteFolderProps[]>();
    for (const f of folders) {
        const key = f.parentFolderId ?? null;
        const bucket = byParent.get(key) ?? [];
        bucket.push(f);
        byParent.set(key, bucket);
    }
    const rows: FolderRow[] = [];
    const walk = (parentId: number | null, depth: number) => {
        const kids = [...(byParent.get(parentId) ?? [])].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        for (const f of kids) {
            rows.push({ folderId: f.folderId, label: f.name, depth });
            walk(f.folderId, depth + 1);
        }
    };
    walk(null, 0);
    return rows;
};

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
    hostZIndex,
    allowDestinationChange = false,
}: Props) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [fileName, setFileName] = useState<string | null>(null);
    const [fileText, setFileText] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [folderId, setFolderId] = useState<number | null>(null);
    // Selected task / chat destination, as the picker's option key. Seeded
    // from `context` on open, so confirming without touching the picker
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
            setFolderId(context.kind === "my" ? (context.folderId ?? null) : null);
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
                      : null
            );
            setImporting(false);
            setError(null);
        }
    }, [open]);

    // Destination controls are only offered on the note-header path.
    // Opened from a sidebar folder row, the row IS the destination — for
    // every kind, so my-notes doesn't get a picker there either.
    const folderRows = useMemo(
        () =>
            allowDestinationChange && context.kind === "my"
                ? flattenFolders(useNM.myNoteFolders)
                : [],
        [allowDestinationChange, context.kind, useNM.myNoteFolders]
    );

    // Task / chat destinations. Only real tasks and real chats can hold a
    // note, so these lists carry no project or chat-type root rows —
    // see `noteImportDestinations`.
    const taskDestinations = useMemo(
        () =>
            allowDestinationChange && context.kind === "task"
                ? buildTaskNoteDestinations(useNM.taskNoteMeta, t)
                : [],
        [allowDestinationChange, context.kind, useNM.taskNoteMeta, t]
    );
    const chatDestinations = useMemo(
        () =>
            allowDestinationChange && context.kind === "chat"
                ? buildChatNoteDestinations(useNM.chatNoteMeta, t)
                : [],
        [allowDestinationChange, context.kind, useNM.chatNoteMeta, t]
    );

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
            sx={hostZIndex != null ? { zIndex: hostZIndex + 1 } : undefined}
            onClose={onClose}
        >
            <ModalDialog sx={{ minWidth: 380, maxWidth: 460 }}>
                <Typography level="title-lg">{t.notes.importMd.heading}</Typography>
                <Stack spacing={2} sx={{ mt: 1 }}>
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

                    {context.kind === "my" && allowDestinationChange && (
                        <FormControl>
                            <FormLabel>{t.notes.importMd.folderLabel}</FormLabel>
                            <Select value={folderId} onChange={(_e, v) => setFolderId(v ?? null)}>
                                <Option value={null}>{t.notes.importMd.rootFolder}</Option>
                                {folderRows.map((row) => (
                                    <Option key={row.folderId} value={row.folderId}>
                                        {`${" ".repeat(row.depth * 3)}${row.label}`}
                                    </Option>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {/* Task / chat destination. Every option is a real
                        task or chat — a note can't live on a project or
                        on a "DM" / "GM" bucket, so those rows have no
                        entry here, and there is no "none" option for the
                        same reason. */}
                    {context.kind === "task" && taskDestinations.length > 0 && (
                        <FormControl>
                            <FormLabel>{t.notes.importMd.folderLabel}</FormLabel>
                            <Select
                                value={destinationKey}
                                onChange={(_e, v) => setDestinationKey(v ?? destinationKey)}
                            >
                                {taskDestinations.map((row) => (
                                    <Option key={row.key} value={row.key}>
                                        {row.label}
                                    </Option>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {context.kind === "chat" && chatDestinations.length > 0 && (
                        <FormControl>
                            <FormLabel>{t.notes.importMd.folderLabel}</FormLabel>
                            <Select
                                value={destinationKey}
                                onChange={(_e, v) => setDestinationKey(v ?? destinationKey)}
                            >
                                {chatDestinations.map((row) => (
                                    <Option key={row.key} value={row.key}>
                                        {row.label}
                                    </Option>
                                ))}
                            </Select>
                        </FormControl>
                    )}

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
            </ModalDialog>
        </Modal>
    );
};
