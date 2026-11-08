import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

import { usersChannel } from "../../db/workers/channels";
import { findTeam } from "../../features/admin/services/findTeam";
import { loadMyTeams } from "../../features/admin/services/loadMyTeams";
import { popTeamMembers } from "../../features/admin/services/popTeamMembers";
import { FindTeamResponse, Team, UserProps } from "../../types/admin";
import { keepIfEqual } from "../../utils/keepIfEqual";

// Heartbeats rewrite every online member's `tsLastSeen` once a minute, so the
// roster read below differs from the previous one on every tick even when
// nobody changed anything anyone can see. The UI never renders the timestamp
// (presence is the `isOnline` flag the worker derives from it, which IS
// compared), so it must not count as a change.
const ROSTER_IGNORED_KEYS = ["tsLastSeen"] as const;

export interface TeamManagementState {
    currentTeamId: string;
    setCurrentTeamId: (id: string) => void;
    teamMembers: UserProps[];
    setTeamMembers: (members: UserProps[]) => void;
    teamMemberProfiles: Record<string, UserProps>;
    // Widened to React's Dispatch so call-sites can use the functional updater
    // form (`setTeamMemberProfiles((prev) => ({ ...prev, [id]: ... }))`)
    // without a cast. Single-arg callers continue to work.
    setTeamMemberProfiles: Dispatch<SetStateAction<Record<string, UserProps>>>;
    currentTeam: Team;
    setCurrentTeam: (team: Team) => void;
    funcSetTeamMembers: () => Promise<void>;
    initCurrentTeam: () => Promise<void>;
}
export const useTeamManagement = (
    myself: UserProps,
    accessToken: string | null
): TeamManagementState => {
    const [currentTeamId, setCurrentTeamId] = useState("");
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    const [teamMemberProfiles, setTeamMemberProfiles] = useState<Record<string, UserProps>>({});
    const [currentTeam, setCurrentTeam] = useState<Team>({
        teamId: myself.teamId,
        teamName: myself.teamName,
        teamEmail: "",
        teamOwnerId: "",
        teamImgPath: localStorage.getItem("teamImgPath") || undefined,
    });
    // Track the active interval id so a `myself` change cancels the previous
    // interval before scheduling a new one. Without this, every re-run of the
    // effect would stack another interval on top of the old one.
    const intervalRef = useRef<number | null>(null);

    // Reads the roster (one row per member, with presence) out of IndexedDB and
    // hands it to `teamMemberProfiles`, the map every avatar resolves a person
    // through. `alsoMembers` additionally feeds `teamMembers` (the 60 s poll
    // does; `funcSetTeamMembers` has its own, sorted, read for that list).
    const loadProfiles = (who: UserProps, alsoMembers: boolean) =>
        usersChannel
            .request("popTeamUsers", { myself: who })
            .then((data) => {
                if (data && typeof data === "object" && "error" in data) {
                    console.error("popTeamUsers failed:", data.error);
                    return;
                }
                const record = data as Record<string, UserProps>;
                // This runs every 60 s and the worker rebuilds the record
                // from IndexedDB each time, so an unchanged roster comes
                // back as a new object and a new array. Keep the previous
                // references when the content is equal: the task table's
                // row memos compare `teamMembers` by reference, so a fresh
                // array re-rendered every visible row once a minute. A
                // real change (a new member, a new avatar, a status or
                // presence flip) still produces a new reference; the
                // heartbeat timestamp alone does not.
                setTeamMemberProfiles((prev) => keepIfEqual(prev, record, ROSTER_IGNORED_KEYS));
                if (!alsoMembers) return;
                const members = Object.values(record);
                if (members.length > 0) {
                    setTeamMembers((prev) => keepIfEqual(prev, members, ROSTER_IGNORED_KEYS));
                }
            })
            .catch((err) => {
                console.error("popTeamUsers error:", err);
            });

    // Called when the roster has just been (re)written to IndexedDB (the boot
    // and wake refreshes). It must repaint BOTH lists: on a cold start the two
    // reads the 60 s poll made before the roster landed came back empty, and
    // with only `teamMembers` refreshed here `teamMemberProfiles` stayed `{}`
    // for up to a minute — every avatar resolved through it (the DM list, the
    // chat bubbles) showed "?" for the whole first minute (MIP-1244).
    const funcSetTeamMembers = async () => {
        const [teamMembers] = await Promise.all([
            popTeamMembers(myself),
            loadProfiles(myself, false),
        ]);
        if (teamMembers) {
            // Same identity guard as the 60 s poll below: the boot / wake
            // refresh re-reads the roster, and an equal one is not a change.
            setTeamMembers((prev) => keepIfEqual(prev, teamMembers, ROSTER_IGNORED_KEYS));
        }
    };

    const initCurrentTeam = async () => {
        const findTeamRes: FindTeamResponse = await findTeam(accessToken, myself.teamId);
        if (findTeamRes && findTeamRes.exist === true) {
            // `/team/exist/` answers "does this team exist and what is it
            // called" for anyone, so it cannot say whether WE belong to it.
            // The my-teams list can, and it is the heartbeat's endpoint —
            // already warm and server-cached. Without this flag a host-team
            // shell is indistinguishable from a small team, and every
            // member-only control renders for someone the server will
            // refuse. Failure leaves it undefined, i.e. treated as member,
            // which is what the app did before this existed.
            const teams: Team[] | undefined = await loadMyTeams(accessToken, myself.userId);
            const mine = teams?.find((tm) => tm.teamId === myself.teamId);
            setCurrentTeam({ ...findTeamRes.teamDetails, isGuest: mine?.isGuest });
        }
    };

    // Update team when myself changes.
    //
    // `currentTeamId` is deliberately NOT advanced here. `useAppInitialization`
    // owns it, and only sets it once the team-switch wipe of the team-scoped
    // IndexedDB stores has finished. Everything team-scoped keys off it —
    // `refreshAllData`, the socket, the project/task and service managers — so
    // publishing the new id from here (synchronously, while that wipe was still
    // awaiting) started the new team's network sync against the OLD team's
    // cache. The inbox sync is the one that showed it: it read the previous
    // team's delta checkpoint, asked the server for "everything since then",
    // got the handful of rows that changed in the meantime, and left an
    // otherwise empty inbox behind — with `bootRefreshedTeamRef` in App
    // suppressing any further refresh for that team.
    useEffect(() => {
        initCurrentTeam();

        if (!myself.userId) return;

        const refresh = () => {
            void loadProfiles(myself, true);
        };

        refresh();
        intervalRef.current = window.setInterval(refresh, 60_000);

        return () => {
            if (intervalRef.current !== null) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [myself]);

    return {
        currentTeamId,
        setCurrentTeamId,
        teamMembers,
        setTeamMembers,
        teamMemberProfiles,
        setTeamMemberProfiles,
        currentTeam,
        setCurrentTeam,
        funcSetTeamMembers,
        initCurrentTeam,
    };
};
