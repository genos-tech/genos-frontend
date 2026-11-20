import { UserProps } from "../../../types/admin";
import { Milestone } from "../sprint-milestone/types";

// Resolve the milestone's reporter (FK on the milestone) to a UserProps,
// preferring a hit in the team-members list so fields like avatar /
// status are populated. Falls back to a synthesised UserProps from the
// embedded payload. A milestone with NO reporter (the FK is SET_NULL, so a
// hard-deleted account leaves none) resolves to `null`: never to the person
// looking at it, which made the preview show them as the reporter and made
// any edit PATCH them in as one (MIP-1730).
export const milestoneReporterToUserProps = (
    m: Milestone | null | undefined,
    teamMembers: UserProps[]
): UserProps | null => {
    if (!m) return null;
    const reporterId = m.reporter?.userId ?? m.reporterId ?? null;
    if (reporterId == null) return null;
    const found = teamMembers.find((u) => String(u.userId) === String(reporterId));
    if (found) return found;
    if (m.reporter) {
        return {
            userId: String(m.reporter.userId),
            userName: m.reporter.username || m.reporter.email || "",
            userEmail: m.reporter.email || "",
            avatarImgPath: m.reporter.profileImageUrl || "",
            teamId: "",
            teamName: "",
            tsLastSeen: "",
            tsJoined: "",
        } as unknown as UserProps;
    }
    return null;
};

// The reporter part of a milestone PATCH: what the preview's working copy says
// against what the milestone stores. `undefined` = nothing to send (the key is
// left out of the PATCH); otherwise the id to send (null clears).
export const milestoneReporterPatch = (
    next: { reporter?: UserProps | null },
    milestone: Milestone
): string | null | undefined => {
    const nextReporterId = next.reporter?.userId ? String(next.reporter.userId) : null;
    const currentReporterId = milestone.reporter?.userId
        ? String(milestone.reporter.userId)
        : milestone.reporterId != null
          ? String(milestone.reporterId)
          : null;
    return nextReporterId !== currentReporterId ? nextReporterId : undefined;
};
