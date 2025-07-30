import { getTeamMembers } from "../db/crud";
import { UserProps } from "../types/admin";

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const teamMembers = await getTeamMembers(myself.teamId);

    if (teamMembers) {
        self.postMessage(teamMembers);
    } else {
        self.postMessage([]);
    }
};

export {};
