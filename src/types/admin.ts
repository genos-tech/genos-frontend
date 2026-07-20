import { ProjectLabelProps } from "./tasks";

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
    // The user's self-declared JOB TITLE ("Engineer"), set via the
    // UserProfileRole picker. NOT a permission — see `memberRole` below.
    role?: string;
    // Permission role within the entity this payload came from:
    // "editor" or "viewer". Absent on payloads that don't carry
    // membership context (and on any pre-feature cached response), which
    // `resolveDisplayRole` treats as viewer.
    //
    // The OWNER is never encoded here — ownership lives in the entity's
    // owner id, so an owner's row reads "viewer". Always render through
    // `resolveDisplayRole` (utils/memberRoles.ts), never raw.
    memberRole?: string;
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

export type SignUpVerificationResponse = {
    message: "verification_email_sent";
    email: string;
};

export type SignInUnverifiedResult = {
    kind: "unverified";
    email: string;
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

export type ProjectProfileProps = {
    projectId: number;
    projectName: string;
    ownerUserId: string;
    profileImagePath: string;
    projectMembers: UserProps[];
    isPrivate: boolean;
    tsCreatedAt: string;
    // Short uppercase code shown as the prefix in human-readable task
    // display IDs (the "GEN" in "GEN-42"). Editable from the project
    // profile modal; auto-derived on project create.
    code?: string | null;
    // Team-scoped labels currently assigned to this project. See
    // `ProjectLabelProps` in types/tasks.ts — these tag the PROJECT,
    // unlike the per-project tags that tag its tasks.
    projectLabels?: ProjectLabelProps[];
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
