import { useEffect, useMemo, useRef } from "react";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { Autocomplete, Stack, Typography } from "@mui/joy";

import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { useTranslation } from "../../../../i18n";
import { stripOwnerState } from "../../../../utils/joyAutocomplete";

type FolderOption = { id: number | null; label: string };

type Props = {
    projectId: number | undefined;
    useSM: SprintMilestoneManagementState;
    folderId: number | null | undefined;
    onChangeFolder: (folderId: number | null) => void;
    disabled?: boolean;
    size?: "sm" | "md";
};

/**
 * The milestone's folder (MIP-847): one of the project's folders, or none.
 * Sits next to the sprint picker in the milestone create form and preview.
 * Folders are loaded on first use for the project, so the picker works in
 * the create form even when the sidebar has not been opened.
 */
export const MilestoneFolderPicker = ({
    projectId,
    useSM,
    folderId,
    onChangeFolder,
    disabled,
    size = "sm",
}: Props) => {
    const { t } = useTranslation();
    const folders = useMemo(
        () => (projectId ? (useSM.projectFolders[projectId] ?? []) : []),
        [projectId, useSM.projectFolders]
    );

    // One fetch per project the picker has been shown for. A ref (not state)
    // so it never re-renders, and keyed by project so a project switch in the
    // create form loads the new project's folders.
    const requested = useRef<Set<number>>(new Set());
    const { projectFolders, loadFoldersForProject } = useSM;
    useEffect(() => {
        if (!projectId || projectFolders[projectId] || requested.current.has(projectId)) return;
        requested.current.add(projectId);
        void loadFoldersForProject(projectId);
    }, [projectId, projectFolders, loadFoldersForProject]);

    const noFolder = useMemo<FolderOption>(
        () => ({ id: null, label: t.tasks.folders.noFolder }),
        [t]
    );
    const options = useMemo<FolderOption[]>(
        () => [
            noFolder,
            ...[...folders]
                .sort((a, b) => a.sortOrder - b.sortOrder || a.folderId - b.folderId)
                .map((f) => ({ id: f.folderId, label: f.name })),
        ],
        [folders, noFolder]
    );
    // A folder id this project does not have (picked before a project switch)
    // reads as "No folder" instead of a stale name.
    const selected = options.find((o) => o.id === (folderId ?? null)) ?? noFolder;

    return (
        <Autocomplete
            disabled={disabled}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            options={options}
            size={size}
            sx={{ flex: 1, minWidth: 0 }}
            value={selected}
            renderOption={(props, option) => (
                <li {...stripOwnerState(props)} key={`f-${option.id ?? "none"}`}>
                    <Stack alignItems="center" direction="row" spacing={1}>
                        {option.id != null && (
                            <FolderRoundedIcon sx={{ fontSize: 14, opacity: 0.7 }} />
                        )}
                        <Typography
                            level="body-sm"
                            sx={{ fontWeight: option.id == null ? 400 : 600 }}
                        >
                            {option.label}
                        </Typography>
                    </Stack>
                </li>
            )}
            disableClearable
            onChange={(_, v) => onChangeFolder(v?.id ?? null)}
        />
    );
};
