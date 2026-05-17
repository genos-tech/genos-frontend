// User Props
export type UserProps = {
    teamId: string;
    teamName: string;
    userId: string;
    userName: string;
    userEmail: string;
    avatarImgPath: string;
    tsLastSeen: string;
    isOnline?: boolean;
    tsJoined: string;
    customStatus?: string;
    isOfflineForced?: string;
    role?: string;
    baseCountry?: string;
    isSystemUser?: boolean;
};

export type Team = {
    teamId: string;
    teamName: string;
    teamEmail: string;
    teamOwnerId: string;
    teamImgPath?: string;
};

// Response
export type SignInResponse = {
    username: string;
    user_id: string;
    email: string;
    access: string;
    message: string;
    profile_image_file_name: string;
    is_offline_forced: string;
    custom_status: string;
    role: string;
    base_country: string;
    ts_joined_at: string;
};

export type DemoSignInResponse = SignInResponse & {
    team_id: string;
    team_name: string;
    is_demo: boolean;
};

export type SignUpResponse = {
    access: string;
    refresh: string;
    user: {
        username: string;
        email: string;
        id: string;
    };
    message: string;
};

export type MyTeamResponse = {
    team_ids: number[];
};

export type FindTeamResponse = {
    exist: boolean;
    teamDetails: Team;
};

export type CreateTeamResponse = {
    teamDetails: Team;
    detail: string | null;
    hint: string | null;
};

export type CreateDMResponse = {
    dm_id: number;
    dm_exists: boolean;
    ts_created_at: string;
    ts_updated_at: string;
    user_1_id: string;
    user_2_id: string;
};

export type ProjectProfileProps = {
    projectId: number;
    projectName: string;
    ownerUserId: string;
    profileImagePath: string;
    projectMembers: UserProps[];
    isPrivate: boolean;
    tsCreatedAt: string;
};

export type TeamProfileProps = {
    teamId: string;
    teamName: string;
    teamEmail: string;
    teamOwnerId: string;
    teamImgPath: string;
    teamMembers: UserProps[];
    tsCreatedAt: string;
};
