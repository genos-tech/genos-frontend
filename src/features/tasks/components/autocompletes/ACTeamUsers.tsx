import Autocomplete from '@mui/joy/Autocomplete';

import { UserProps } from '../../../../types/admin';
import { TaskProps } from '../../../../types/tasks';

type ACTeamUsersProps = {
    myself: UserProps;
    initialUser: UserProps;
    teamMembers: UserProps[],
    taskContents: TaskProps,
    setTaskContents: (value: TaskProps) => void,
    setUser: (value: UserProps) => void,
    isOpenTeamMembersList: boolean,
    setIsOpenTeamMembersList: (value: boolean) => void,
    isAssignee: boolean,
    setTaskUpdated?: (value: boolean) => void,
}
export const ACTeamUsers = (props: ACTeamUsersProps) => {
    const {
        myself,
        initialUser,
        teamMembers,
        taskContents,
        setTaskContents,
        setUser,
        isOpenTeamMembersList,
        setIsOpenTeamMembersList,
        isAssignee,
        setTaskUpdated
    } = props;

    return (
        <Autocomplete
            key={taskContents.id}
            options={teamMembers}
            getOptionLabel={(option) => `${option.userName} | ${option.userEmail}`}
            value={initialUser || myself}
            isOptionEqualToValue={(option, value) => option.userId === value.userId}
            onChange={(event, value) => {
                if (value !== null) {
                    if (isAssignee) {
                        setTaskContents({
                            ...taskContents,
                            assignee: value
                        });
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    } else {
                        setTaskContents({
                            ...taskContents,
                            reporter: value
                        });
                        if (setTaskUpdated) {
                            setTaskUpdated(true);
                        }
                    }
                    setUser(value)
                }
            }}
            onOpen={() => setIsOpenTeamMembersList(!isOpenTeamMembersList)}
            size="sm"
            sx={{ width: '100%' }}
        />
    )
}