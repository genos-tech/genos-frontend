import { AutocompleteOption } from "@mui/joy";
import Autocomplete from "@mui/joy/Autocomplete";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskProps } from "../../../../types/tasks";
import { projectAvatarSrc } from "../../utils/projectAvatar";
import { ProjectIdentityDecorator, ProjectIdentityRow } from "../ProjectIdentityRow";

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
    /** Read-only mount. Set for sub-tasks, whose project is their parent's
     *  — see `TaskMainBlock`, which owns that rule and explains it. */
    disabled?: boolean;
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
        disabled = false,
    } = props;

    const selectedProject = taskContent.project?.projectId ? taskContent.project : undefined;
    // `taskContent.project` is a stub — `onChange` below writes only the
    // id and name onto the task, so reading the labels, lock or share
    // mark off it would blank them the instant a project is picked. The
    // team list is where the full record lives, and it's the same array
    // the options come from, so the closed field can't disagree with the
    // row the user just clicked.
    const selectedIdentity = selectedProject
        ? (usePM.teamProjects.find((p) => p.projectId === selectedProject.projectId) ??
          selectedProject)
        : undefined;

    return (
        <Autocomplete
            key={taskContent.id}
            disabled={disabled}
            // Still the plain name: this is what type-to-filter matches
            // on, and — the field being a text input — all the closed
            // state can display. The richer content below is presentation
            // only; `startDecorator` puts as much of it as fits back
            // beside the name once a project is picked.
            getOptionLabel={(option) => option.projectName}
            isOptionEqualToValue={(option, value) => option.projectId === value.projectId}
            options={usePM.teamProjects}
            size="sm"
            sx={{ width: "100%" }}
            value={selectedProject}
            renderOption={(optionProps, option) => (
                // Joy's own option component, NOT a bespoke <li>: it
                // brings the padding, hover, focus and selected states
                // that make these rows look like the `Option`s in a Joy
                // Select (e.g. the dashboard's project picker). A plain
                // <li> renders unstyled — cramped, with no hover
                // feedback. It also consumes Joy's internal `ownerState`,
                // so no `stripOwnerState` is needed here.
                <AutocompleteOption
                    {...optionProps}
                    key={option.projectId}
                    sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
                >
                    <ProjectIdentityRow
                        avatarSrc={projectAvatarSrc(option.projectId, useCM?.allChats)}
                        maxLabels={2}
                        project={option}
                    />
                </AutocompleteOption>
            )}
            startDecorator={
                // Only the option LABEL — a bare name — can live inside
                // the closed field's <input>, so the avatar and markers
                // ride alongside it here. Omitted entirely while empty,
                // rather than rendered blank: Joy still lays out the
                // decorator slot's gap around an empty child.
                selectedIdentity ? (
                    <ProjectIdentityDecorator
                        avatarSrc={projectAvatarSrc(selectedIdentity.projectId, useCM?.allChats)}
                        project={selectedIdentity}
                    />
                ) : undefined
            }
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
