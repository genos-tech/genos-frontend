import { STORES } from "../db/conf";
import { addData } from "../db/crud";
import { UserProps } from "../types/admin";

self.onmessage = async (event) => {
    const user: UserProps = event.data.user;

    await addData({
        storeName: STORES.USER_INFO,
        data: user,
    });

    self.postMessage("done");
};

export {};
