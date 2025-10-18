import { InboxItemProps } from "../../types/common";
import { STORES } from "../config";
import { BaseRepository } from "./base";

// Inbox repository for managing inbox items
export class InboxRepository extends BaseRepository<InboxItemProps> {
    constructor() {
        super(STORES.INBOX);
    }
}
