/**
 * The "whole folder" half of the import dialog.
 *
 * Built for migrating a Notion export: point it at the unzipped folder
 * and it recreates the tree as note folders and notes, images included.
 *
 * The preview is the point of the layout. This creates hundreds of
 * folders and notes in someone's workspace and there is no undo, so what
 * the plan will do is shown in full — named and indented exactly as it
 * will land — before the button that does it becomes interesting.
 */

import { useRef, useState } from "react";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import DriveFolderUploadRoundedIcon from "@mui/icons-material/DriveFolderUploadRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { Button, LinearProgress, Sheet, Stack, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import {
    buildFolderImportPlan,
    describePlan,
    type FolderImportPlan,
} from "../services/folderImportPlan";
import {
    runFolderImport,
    type FolderImportProgress,
    type FolderImportResult,
    type ImportDestination,
} from "../services/runFolderImport";

// `webkitdirectory` turns a file input into a folder picker. It predates
// any standard and React's JSX types don't carry it, but every browser
// this app supports implements it — and it's the only thing that hands
// back a directory tree from a plain <input>.
declare module "react" {
    interface InputHTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
        webkitdirectory?: string;
    }
}

/** Rows rendered before the preview truncates. Long enough to show the
 *  shape of a real export, short enough not to make the dialog a page. */
const PREVIEW_ROWS = 60;

interface Props {
    destination: ImportDestination;
    myself: UserProps;
    accessToken: string;
    /** Per-file upload ceiling from the user's plan; null when unknown. */
    uploadLimitBytes: number | null;
    /** Reload the sidebar once notes and folders exist on the server. */
    onImported: () => void;
    onClose: () => void;
}

export const FolderImportPanel = ({
    destination,
    myself,
    accessToken,
    uploadLimitBytes,
    onImported,
    onClose,
}: Props) => {
    const { t } = useTranslation();
    const folderInputRef = useRef<HTMLInputElement>(null);

    const [folderName, setFolderName] = useState<string | null>(null);
    const [plan, setPlan] = useState<FolderImportPlan | null>(null);
    const [progress, setProgress] = useState<FolderImportProgress | null>(null);
    const [result, setResult] = useState<FolderImportResult | null>(null);
    // A ref rather than state: the running import polls this between
    // notes, and it must see the click immediately rather than on the
    // next render.
    const cancelRef = useRef(false);

    const running = progress != null && result == null;

    const handleFolderPicked = (files: FileList) => {
        const picked = [...files];
        setFolderName(picked[0]?.webkitRelativePath.split("/")[0] ?? null);
        setPlan(buildFolderImportPlan(picked));
        setResult(null);
        setProgress(null);
    };

    const handleImport = async () => {
        if (!plan) return;
        cancelRef.current = false;
        setProgress({ done: 0, total: plan.noteCount, label: "" });
        const finished = await runFolderImport({
            plan,
            destination,
            myself,
            accessToken,
            uploadLimitBytes,
            onProgress: setProgress,
            shouldCancel: () => cancelRef.current,
        });
        setResult(finished);
        onImported();
    };

    const rows = plan ? describePlan(plan.root) : [];

    return (
        <Stack spacing={2} sx={{ mt: 1 }}>
            {result == null && (
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                    {t.notes.importMd.folderHint}
                </Typography>
            )}

            {/* `webkitdirectory` is what turns this into a folder picker.
                It is non-standard but implemented everywhere this app
                runs, and it hands back the tree as a flat list whose
                entries carry `webkitRelativePath` — the whole basis of
                the plan. */}
            <input
                ref={folderInputRef}
                style={{ display: "none" }}
                type="file"
                webkitdirectory=""
                onChange={(e) => {
                    if (e.target.files?.length) handleFolderPicked(e.target.files);
                    e.target.value = "";
                }}
            />

            {result == null && (
                <Button
                    color="neutral"
                    disabled={running}
                    startDecorator={<DriveFolderUploadRoundedIcon />}
                    variant="outlined"
                    onClick={() => folderInputRef.current?.click()}
                >
                    {folderName ?? t.notes.importMd.chooseFolder}
                </Button>
            )}

            {plan != null && plan.noteCount === 0 && result == null && (
                <Typography level="body-sm" sx={{ color: "warning.500" }}>
                    {t.notes.importMd.planEmpty}
                </Typography>
            )}

            {plan != null && plan.noteCount > 0 && result == null && (
                <Stack spacing={1}>
                    <Typography level="title-sm">{t.notes.importMd.previewHeading}</Typography>
                    <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                        {fmt(t.notes.importMd.planSummary, {
                            folders: plan.folderCount,
                            notes: plan.noteCount,
                        })}
                    </Typography>
                    <Sheet
                        sx={{ maxHeight: 220, overflowY: "auto", borderRadius: "sm", p: 1 }}
                        variant="soft"
                    >
                        {rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                            <Stack
                                key={`${row.kind}-${row.depth}-${row.label}-${i}`}
                                direction="row"
                                spacing={0.75}
                                sx={{ alignItems: "center", pl: row.depth * 1.5, minWidth: 0 }}
                            >
                                {row.kind === "folder" ? (
                                    <FolderRoundedIcon
                                        sx={{ fontSize: 14, color: "warning.400", flexShrink: 0 }}
                                    />
                                ) : (
                                    <ArticleRoundedIcon
                                        sx={{
                                            fontSize: 14,
                                            color: "text.tertiary",
                                            flexShrink: 0,
                                        }}
                                    />
                                )}
                                <Typography level="body-xs" noWrap>
                                    {row.label}
                                </Typography>
                            </Stack>
                        ))}
                        {rows.length > PREVIEW_ROWS && (
                            <Typography level="body-xs" sx={{ color: "text.tertiary", pt: 0.5 }}>
                                {fmt(t.notes.importMd.previewMore, {
                                    count: rows.length - PREVIEW_ROWS,
                                })}
                            </Typography>
                        )}
                    </Sheet>
                </Stack>
            )}

            {running && progress != null && (
                <Stack spacing={1}>
                    <LinearProgress
                        size="sm"
                        value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
                        determinate
                    />
                    <Typography level="body-xs" sx={{ color: "text.tertiary" }} noWrap>
                        {fmt(t.notes.importMd.importingLabel, {
                            done: progress.done,
                            total: progress.total,
                        })}
                        {progress.label ? ` · ${progress.label}` : ""}
                    </Typography>
                </Stack>
            )}

            {result != null && (
                <Stack spacing={0.5}>
                    <Typography level="body-sm">
                        {fmt(t.notes.importMd.resultNotes, {
                            notes: result.notesCreated,
                            folders: result.foldersCreated,
                        })}
                    </Typography>
                    {result.assetsUploaded > 0 && (
                        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                            {fmt(t.notes.importMd.resultImages, { count: result.assetsUploaded })}
                        </Typography>
                    )}
                    {result.assetsFailed > 0 && (
                        <Typography level="body-xs" sx={{ color: "warning.500" }}>
                            {fmt(t.notes.importMd.resultImagesFailed, {
                                count: result.assetsFailed,
                            })}
                        </Typography>
                    )}
                    {result.failures.length > 0 && (
                        <Typography level="body-xs" sx={{ color: "danger.500" }}>
                            {fmt(t.notes.importMd.resultFailures, {
                                count: result.failures.length,
                            })}
                        </Typography>
                    )}
                    {result.cancelled && (
                        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                            {t.notes.importMd.resultCancelled}
                        </Typography>
                    )}
                </Stack>
            )}

            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                {result != null ? (
                    <Button onClick={onClose}>{t.notes.importMd.resultDone}</Button>
                ) : running ? (
                    <Button
                        color="danger"
                        variant="soft"
                        onClick={() => {
                            cancelRef.current = true;
                        }}
                    >
                        {t.notes.importMd.stopButton}
                    </Button>
                ) : (
                    <>
                        <Button variant="plain" onClick={onClose}>
                            {t.common.actions.cancel}
                        </Button>
                        <Button
                            disabled={plan == null || plan.noteCount === 0}
                            onClick={handleImport}
                        >
                            {t.notes.importMd.importFolderButton}
                        </Button>
                    </>
                )}
            </Stack>
        </Stack>
    );
};
