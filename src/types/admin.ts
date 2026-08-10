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
    /** Absolute UTC ISO instant at which `customStatus` auto-clears — Slack's
     *  "clear status after". Unlike the private pause expiry, this rides to
     *  EVERYONE (heartbeat + all four roster surfaces) so teammates read
     *  "back Tue 9 AM". `null`/absent = the status never expires. A past value
     *  means expired: the status is masked at read time (`isStatusExpired`),
     *  and the owner's own client PUT-clears both fields so the DB converges —
     *  the same lazy-at-read-time discipline as the snooze/pause fields. */
    customStatusExpiry?: string | null;
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
    /** Absent — not empty — on rows the server built for someone outside
     *  the team. A guest reaches a roster through the one project they
     *  were invited to and a cross-team collaborator through the one
     *  object shared with them; neither is a colleague, so the server
     *  omits the key entirely rather than blanking it. Treat "missing"
     *  and "not set" the same: both mean don't render the row. */
    phoneNumber?: string;
    /** IANA zone the user PICKED as their location ("Asia/Tokyo"). Its
     *  city component is the location label, and it wins over `timezone`
     *  for local time — see `resolveDisplayZone` in utils/userTimezone. */
    currentLocation?: string;
    /** IANA zone their BROWSER last reported. Written on every boot by
     *  `useReportBrowserTimezone`, so it tracks where someone actually
     *  is; used for local time only when they haven't picked a location. */
    timezone?: string;
    /** Free-text self-introduction, rendered as restricted markdown by
     *  `ProfileMarkdown`. Capped at 500 characters server-side. */
    aboutMe?: string;
    isSystemUser?: boolean;
    /** This person belongs to ANOTHER team and is in this roster only
     *  because a cross-team share put the two of you on the same object.
     *  Server-decided (`GetTeamMembersView`). `teamId` above stays the team
     *  whose roster this row was fetched for — that is the key the client
     *  caches and reads by — so their real team travels in `homeTeam*`.
     *  Conflating the two is what makes another company's staff read as
     *  your own colleague, which the avatar's team badge exists to prevent.
     *
     *  Recognizing them is not the same as being able to hand them things:
     *  they must not appear in pickers that ADD a member to something
     *  (chats, folders, projects), because the server refuses. */
    isExternal?: boolean;
    homeTeamId?: string;
    homeTeamName?: string;
    homeTeamImgPath?: string;
    /** Slack-style "pause notifications" indicator, broadcast on the presence
     *  heartbeat like `isOnline`/`isOfflineForced`. `true` while the user has
     *  an active one-shot or scheduled pause; drives the moon badge on their
     *  avatar. Only the boolean travels — the expiry/schedule stay private to
     *  the owner + server. Absent (pre-feature / never-paused rows) = not
     *  paused. Freshness matches presence: updated on the owner's next beat
     *  (≤60s), instant for self via `AvatarContext.selfNotificationsPaused`. */
    isNotificationsPaused?: boolean;
};

export type Team = {
    teamId: string;
    teamName: string;
    teamEmail: string;
    teamOwnerId: string;
    teamImgPath?: string;
    /** The caller reaches this team from OUTSIDE — as a project guest or
     *  through a cross-team share — so it is a shell with a deliberately
     *  narrowed roster rather than a membership. Server-decided
     *  (`GetMyTeamsView`). Member-only affordances must stay hidden here:
     *  they would offer actions the server refuses. Absent means member. */
    isGuest?: boolean;
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
    phone_number: string;
    current_location: string;
    about_me: string;
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
    /** The team that OWNS the project. Differs from the viewer's team when
     *  the project was shared with theirs, which is what host-only
     *  controls in the profile modal key off. */
    teamId?: string;
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
    /** See `Team.isGuest` — the same server field, carried here because
     *  the profile modal is where team-membership actions live. */
    isGuest?: boolean;
};
