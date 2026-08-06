/**
 * "Export folder as .zip" — the mirror of the folder importer.
 *
 * Shows what is about to be gathered before gathering it, because a big
 * folder means a few hundred requests and a wait, and because knowing it
 * is 12 folders rather than 400 is what tells the user whether to bother.
 *
 * The download fires on its own the moment the zip exists, so the common
 * case is two clicks. The dialog stays open afterwards only to report
 * what came across — notably any images that couldn't be fetched, which
 * are the one thing a user cannot tell from the zip itself.
 */

import { useMemo, useRef, useState } from "react";
import FolderZipRoundedIcon from "@mui/icons-material/FolderZipRounded";
import { Button, LinearProgress, Modal, ModalDialog, Stack, Typography } from "@mui/joy";

import { fmt, useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { MyNoteFolderProps, MyNoteMetaProps } from "../../../../types/notes";
import { buildFolderExportPlan } from "../services/folderExportPlan";
import {
    downloadZip,
    runFolderExport,
    type ExportSource,
    type FolderExportProgress,
    type FolderExportResult,
} from "../services/runFolderExport";

export type ExportFolderTarget = {
    folderId: number;
    name: string;
    source: ExportSource;
};

interface Props {
    target: ExportFolderTarget | null;
    folders: MyNoteFolderProps[];
    noteMeta: MyNoteMetaProps[];
    myself: UserProps;
    accessToken: string | null;
    onClose: () => void;
}

export const ModalExportFolder = ({
    target,
    folders,
    noteMeta,
    myself,
    accessToken,
    onClose,
}: Props) => {
    const { t } = useTranslation();

    const [progress, setProgress] = useState<FolderExportProgress | null>(null);
    const [result, setResult] = useState<FolderExportResult | null>(null);
    // A ref rather than state: the running export polls this between
    // notes, and it must see the click immediately rather than on the
    // next render.
    const cancelRef = useRef(false);

    const plan = useMemo(
        () =>
            target
                ? buildFolderExportPlan({
                      rootFolderId: target.folderId,
                      rootName: target.name,
                      folders,
                      noteMeta,
                  })
                : null,
        [target, folders, noteMeta]
    );

    const running = progress != null && result == null;

    const handleClose = () => {
        cancelRef.current = true;
        setProgress(null);
        setResult(null);
        onClose();
    };

    const handleExport = async () => {
        if (!plan || !target || !accessToken) return;
        cancelRef.current = false;
        setProgress({ done: 0, total: plan.entries.length, label: "" });
        const finished = await runFolderExport({
            plan,
            source: target.source,
            myself,
            accessToken,
            onProgress: setProgress,
            shouldCancel: () => cancelRef.current,
        });
        setResult(finished);
        if (finished.blob) downloadZip(finished.fileName, finished.blob);
    };

    const noteCount = plan?.entries.length ?? 0;

    return (
        <Modal
            open={target != null}
            sx={{ zIndex: 10010, backdropFilter: "blur(4px)" }}
            onClose={running ? undefined : handleClose}
        >
            <ModalDialog
                sx={{
                    borderRadius: "16px",
                    width: { xs: "calc(100vw - 24px)", md: "420px" },
                    p: { xs: 2, md: 3 },
                }}
            >
                <Stack alignItems="center" direction="row" spacing={1} sx={{ mb: 1 }}>
                    <FolderZipRoundedIcon sx={{ fontSize: 20 }} />
                    <Typography level="title-lg">{t.notes.exportZip.heading}</Typography>
                </Stack>

                <Typography level="title-sm" noWrap>
                    {target?.name}
                </Typography>

                {result == null && (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                        <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
                            {noteCount === 0
                                ? t.notes.exportZip.empty
                                : fmt(t.notes.exportZip.summary, {
                                      folders: plan?.folderCount ?? 0,
                                      notes: noteCount,
                                  })}
                        </Typography>
                        {noteCount > 0 && (
                            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                                {t.notes.exportZip.hint}
                            </Typography>
                        )}
                    </Stack>
                )}

                {running && progress != null && (
                    <Stack spacing={1} sx={{ mt: 2 }}>
                        <LinearProgress
                            size="sm"
                            value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
                            determinate
                        />
                        <Typography level="body-xs" sx={{ color: "text.tertiary" }} noWrap>
                            {fmt(t.notes.exportZip.progress, {
                                done: progress.done,
                                total: progress.total,
                            })}
                            {progress.label ? ` · ${progress.label}` : ""}
                        </Typography>
                    </Stack>
                )}

                {result != null && (
                    <Stack spacing={0.5} sx={{ mt: 2 }}>
                        <Typography level="body-sm">
                            {fmt(t.notes.exportZip.resultNotes, { count: result.notesExported })}
                        </Typography>
                        {result.imagesIncluded > 0 && (
                            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                                {fmt(t.notes.exportZip.resultImages, {
                                    count: result.imagesIncluded,
                                })}
                            </Typography>
                        )}
                        {result.imagesFailed > 0 && (
                            <Typography level="body-xs" sx={{ color: "warning.500" }}>
                                {fmt(t.notes.exportZip.resultImagesFailed, {
                                    count: result.imagesFailed,
                                })}
                            </Typography>
                        )}
                        {result.failures.length > 0 && (
                            <Typography level="body-xs" sx={{ color: "danger.500" }}>
                                {fmt(t.notes.exportZip.resultFailures, {
                                    count: result.failures.length,
                                })}
                            </Typography>
                        )}
                        {result.cancelled && (
                            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                                {t.notes.exportZip.resultCancelled}
                            </Typography>
                        )}
                    </Stack>
                )}

                <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
                    {result != null ? (
                        <Button onClick={handleClose}>{t.notes.exportZip.done}</Button>
                    ) : running ? (
                        <Button
                            color="danger"
                            variant="soft"
                            onClick={() => {
                                cancelRef.current = true;
                            }}
                        >
                            {t.notes.exportZip.stop}
                        </Button>
                    ) : (
                        <>
                            <Button color="neutral" variant="plain" onClick={handleClose}>
                                {t.common.actions.cancel}
                            </Button>
                            <Button
                                disabled={noteCount === 0 || !accessToken}
                                onClick={handleExport}
                            >
                                {t.notes.exportZip.exportButton}
                            </Button>
                        </>
                    )}
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
