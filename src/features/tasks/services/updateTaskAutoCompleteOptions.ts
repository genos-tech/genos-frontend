import { loadTeamProjects } from '../services/loadTeamProjects';
import { loadProjectTags } from '../services/loadProjectTags';
import { UserProps } from '../../../types/admin';
import { ProjectProps, TagListProps } from "../../../types/tasks";
import { loadTeamMembers } from '../../admin/services/loadTeamMembers';


// update team members options
type UpdateTeamMembersOptions = {
    myself: UserProps;
    accessToken: string | null;
    setTeamMembers: (value: UserProps[]) => void;
}
export const updateTeamMembersOptions = async (props: UpdateTeamMembersOptions) => {
    const { myself, accessToken, setTeamMembers } = props;
    const loadedTeamMembers: UserProps[] = await loadTeamMembers(myself, accessToken);
    if (loadedTeamMembers.length > 0) {
        setTeamMembers(loadedTeamMembers);
    }
};

// update Project options
type UpdateProjectOptions = {
    myself: UserProps;
    accessToken: string | null;
    setTeamProjects: (value: ProjectProps[]) => void;
}
export const updateProjectOptions = async (props: UpdateProjectOptions) => {
    const { myself, accessToken, setTeamProjects } = props;
    const loadedTeamProjects: ProjectProps[] = await loadTeamProjects(
        myself, accessToken
    );
    if (loadedTeamProjects.length > 0) {
        setTeamProjects(loadedTeamProjects);
    };
};

// update Tag options
type UpdateTagOptions = {
    myself: UserProps;
    accessToken: string | null;
    projectId: number;
    setProjectTags: (value: TagListProps[]) => void;
}
export const updateTagOptions = async (props: UpdateTagOptions) => {
    const { myself, accessToken, projectId, setProjectTags } = props;
    const loadedProjectTags: TagListProps[] = await loadProjectTags(
        myself, projectId || -1, accessToken
    );
    if (loadedProjectTags.length > 0) {
        setProjectTags(loadedProjectTags);
    }
};
