import { UserProps } from "../../../types/admin";
import { Milestone } from "../sprint-milestone/types";

// Resolve the milestone's assignees (the embedded payload rows) to UserProps,
// preferring a hit in the team-members list so avatar / status are populated.
export const milestoneAssigneesToUserProps = (
    m: Milestone,
    teamMembers: UserProps[]
): UserProps[] => {
    return m.assignees
        .map<UserProps | null>((a) => {
            if (!a.userId) return null;
            const found = teamMembers.find((u) => String(u.userId) === String(a.userId));
            if (found) return found;
            return {
                userId: String(a.userId),
                userName: a.username || a.email || "",
                userEmail: a.email || "",
                avatarImgPath: a.profileImageUrl || "",
                teamId: "",
                teamName: "",
                tsLastSeen: "",
                tsJoined: "",
            } as unknown as UserProps;
        })
        .filter((u): u is UserProps => u != null);
};

// The assignee part of a milestone PATCH: what the preview's working copy says
// against what the milestone stores. Single-assignee UX over the multi-assignee
// API, so a change is a one-element list and a cleared picker is `[]`.
// `undefined` = nothing to send (the key is left out of the PATCH).
export const milestoneAssigneePatch = (
    next: { assignee?: UserProps | null },
    milestone: Milestone
): string[] | undefined => {
    const nextAssigneeId = next.assignee?.userId ? String(next.assignee.userId) : null;
    const currentAssigneeId = milestone.assignees?.[0]?.userId
        ? String(milestone.assignees[0].userId)
        : null;
    if (nextAssigneeId === currentAssigneeId) return undefined;
    return nextAssigneeId ? [nextAssigneeId] : [];
};
