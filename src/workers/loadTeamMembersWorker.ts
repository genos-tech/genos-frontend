import { loadTeamMembers } from "../features/admin/services/loadTeamMembers";
import { UserProps } from "../types/admin";
import { TaskTableProps } from "../types/tasks";
import { STORES } from "../db/conf";
import { clearStore, addData } from "../db/crud";

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.USER_INFO);

    // Load data from backend
    const memberList: TaskTableProps[] = await loadTeamMembers(myself, accessToken);

    for (let i = 0; i < memberList.length; i += 1) {
        const member: TaskTableProps = memberList[i];
        await addData({
            storeName: STORES.USER_INFO,
            data: member,
        });
    }

    // Send finish a message
    self.postMessage("done");
};

export {};
