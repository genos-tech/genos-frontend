import { UserService } from "../db/services/user.service";

self.onmessage = async (event) => {
    const userId: number = event.data.userId;

    if (userId) {
        const userService = new UserService();
        const user = await userService.getUser(userId.toString());

        if (user) {
            self.postMessage(user);
        } else {
            self.postMessage(null);
        }
    }

    self.close(); // Terminates itself
};

export {};
