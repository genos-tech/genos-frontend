import { Box } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskProps } from "../../../../types/tasks";
import { stripOwnerState } from "../../../../utils/joyAutocomplete";
import { projectAvatarSrc } from "../../utils/projectAvatar";
import { ProjectIdentityRow } from "../ProjectIdentityRow";

type ACTeamProjectsProps = {
    taskContent: TaskProps;
    setTaskContent: (value: TaskProps) => void;
    isOpenProjectList: boolean;
    setIsOpenProjectList: (value: boolean) => void;
    setTaskUpdated?: (value: boolean) => void;
    usePM: ProjectManagementState;
    /** Create-form mounts set this: milestone/sprint are project-scoped,
     * so switching the project invalidates the current picker selection —
     * and the parent/root ids the milestone picker derived from it. If
     * the stale ids ride into the finalize PUT the backend clears them
     * anyway (they belong to the old project), but the FORM would keep
     * showing them, and `addTask` would cache the stale milestoneId onto
     * the created row in IDB. Preview/edit mounts leave this off — there
     * the backend's move handler owns re-linking, an existing sub-task's
     * parent edge must survive a move, and the preview refetches after
     * the PUT. */
    resetMilestoneOnChange?: boolean;
    /** Chat list, used to resolve each project's avatar from its PM
     *  chat. Optional: without it the options still render, just with
     *  the generic project icon instead of the uploaded image. */
    useCM?: ChatManagementState;
};
export const ACTeamProjects = (props: ACTeamProjectsProps) => {
    const {
        usePM,
        taskContent,
        setTaskContent,
        isOpenProjectList,
        setIsOpenProjectList,
        setTaskUpdated,
        resetMilestoneOnChange = false,
        useCM,
    } = props;

    return (
        <Autocomplete
            key={taskContent.id}
            // Still the plain name: this is what type-to-filter matches
            // on and what the closed input displays. The richer content
            // below is presentation only.
            getOptionLabel={(option) => option.projectName}
            isOptionEqualToValue={(option, value) => option.projectId === value.projectId}
            options={usePM.teamProjects}
            size="sm"
            sx={{ width: "100%" }}
            value={taskContent.project?.projectId ? taskContent.project : undefined}
            renderOption={(optionProps, option) => (
                // `stripOwnerState`: Joy injects its internal
                // `ownerState` into these props, and spreading them onto
                // a bespoke <li> leaks it to the DOM — a React warning on
                // every option render. See `utils/joyAutocomplete.ts` and
                // the AutocompleteOwnerStateLeak canary test.
                <Box
                    component="li"
                    {...stripOwnerState(optionProps)}
                    key={option.projectId}
                    sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
                >
                    <ProjectIdentityRow
                        avatarSrc={projectAvatarSrc(option.projectId, useCM?.allChats)}
                        maxLabels={2}
                        project={option}
                    />
                </Box>
            )}
            onOpen={() => setIsOpenProjectList(!isOpenProjectList)}
            onChange={(event, value) => {
                if (value !== null) {
                    const isActualChange = value.projectId !== taskContent.project?.projectId;
                    setTaskContent({
                        ...taskContent,
                        project: {
                            projectId: value.projectId,
                            projectName: value.projectName,
                            projectTags: [],
                            systemUserId: value.systemUserId,
                        },
                        tags: [],
                        ...(resetMilestoneOnChange && isActualChange
                            ? {
                                  milestoneId: null,
                                  sprintId: null,
                                  parentTaskId: null,
                                  rootTaskId: null,
                              }
                            : {}),
                    });
                    if (value.projectId) {
                        usePM.setCurrentProject({
                            projectId: value.projectId,
                            projectName: value.projectName,
                            projectTags: [],
                            systemUserId: value.systemUserId,
                        });
                    } else {
                        console.error("Failed to set the current project");
                    }
                    if (setTaskUpdated) {
                        setTaskUpdated(true);
                    }
                }
            }}
        />
    );
};
