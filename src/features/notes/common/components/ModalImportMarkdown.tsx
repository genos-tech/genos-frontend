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
import { markdownToNoteBlocks, titleFromFilename } from "../services/noteMarkdown";

/** Where the imported note gets created — mirrors the surface the ⋮ menu
 *  was opened from. My-notes additionally pick a destination folder. */
export type ImportMarkdownContext =
    | { kind: "my" }
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
export const ModalImportMarkdown = ({ open, onClose, context, useNM, hostZIndex }: Props) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [fileName, setFileName] = useState<string | null>(null);
    const [fileText, setFileText] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [folderId, setFolderId] = useState<number | null>(null);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fresh state per open.
    useEffect(() => {
        if (open) {
            setFileName(null);
            setFileText(null);
            setTitle("");
            setFolderId(null);
            setImporting(false);
            setError(null);
        }
    }, [open]);

    const folderRows = useMemo(
        () => (context.kind === "my" ? flattenFolders(useNM.myNoteFolders) : []),
        [context.kind, useNM.myNoteFolders]
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
                await useNM.handleCreateNewTaskNote(
                    null,
                    context.projectId,
                    context.taskId,
                    undefined,
                    opts
                );
            } else {
                await useNM.handleCreateNewChatNote(
                    null,
                    context.chatType,
                    context.chatId,
                    context.isThread,
                    context.threadId,
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

                    {context.kind === "my" && (
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
