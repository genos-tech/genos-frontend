import { UserService } from "../services/user.service";
import { UserProps } from "../../types/admin";

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const userService = new UserService();
    const teamMembers = await userService.getTeamMembers(myself.teamId);

    if (teamMembers) {
        self.postMessage(teamMembers);
    } else {
        self.postMessage([]);
    }

    self.close(); // Terminates itself
};

export {};
