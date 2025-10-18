import { UserRepository } from "../db/repositories";
import { loadTeamMembers } from "../features/admin/services/loadTeamMembers";
import { UserProps } from "../types/admin";

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    // Should keep user's past info because it'll be updated when the user is logging in.
    // If offline, the data is not updated, but still need the user info.
    // await clearStore(STORES.USER_INFO);

    // Load data from backend
    const memberList: UserProps[] = await loadTeamMembers(myself, accessToken);

    const userRepo = new UserRepository();

    // Batch insert all team members
    if (memberList && memberList.length > 0) {
        await userRepo.batchInsert(memberList);
    }

    // Send finish a message
    self.postMessage(memberList);

    self.close(); // Terminates itself
};

export {};
