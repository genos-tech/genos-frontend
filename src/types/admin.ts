// User Props
export type UserProps = {
    teamId: string;
    userId: string;
    userName: string;
    userEmail: string;
    avatarImgPath: string | null;
    online: boolean | false;
};

export type Team = {
    teamId: string,
    teamName: string,
    teamEmail: string,
}

// Response
export type SignInResponse = {
    username: string;
    user_id: string;
    email: string;
    access: string;
    message: string;
};

export type SignUpResponse = {
    access: string;
    refresh: string;
    user: any;
    message: string;
};

export type MyTeamResponse = {
    team_ids: number[];
}

export type JoinTeamResponse = {
    teamId: string;
    detail: string | null;
    hint: string | null;
};

export type CreateDMResponse = {
    dm_id: number;
    ts_created_at: string;
    ts_updated_at: string;
    user_1_id: string;
    user_2_id: string;
};