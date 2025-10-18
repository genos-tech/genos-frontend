import { UserService } from "../db/services/user.service";
import { UserProps } from "../types/admin";

self.onmessage = async (event) => {
    const user: UserProps = event.data.user;

    const userService = new UserService();
    await userService.saveUser(user);

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
