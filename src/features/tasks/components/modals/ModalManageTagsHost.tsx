import React from "react";

import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { ModalManageTags } from "./ModalManageTags";

type Props = {
    myself: UserProps;
    usePM: ProjectManagementState;
    useTM: TaskManagementState;
};

/**
 * The one Manage Tags dialog of the task area, opened from any "Manage Tags" menu item
 * through `useTM.openManageTags` (the way "New Tag" opened its own dialog). It edits the
 * current project's tags (`currentProject.projectTags`, which the sidebar refetches when
 * `bumpTagsRevision` fires), so the task preview, the project header and the mobile menu
 * no longer each carry a copy of the tag list and the buttons around it (MIP-1174).
 */
export const ModalManageTagsHost: React.FC<Props> = ({ myself, usePM, useTM }) => {
    const project = usePM.currentProject;
    return (
        <ModalManageTags
            myself={myself}
            open={useTM.openManageTags}
            projectTags={project?.projectTags ?? []}
            usePM={usePM}
            useTM={useTM}
            setProjectTags={(tags) => {
                if (project) usePM.setCurrentProject({ ...project, projectTags: tags });
            }}
            onClose={() => useTM.setOpenManageTags(false)}
        />
    );
};
