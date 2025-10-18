import { STORES } from "../config";
import { InboxItem } from "../types";
import { BaseRepository } from "./base";

// Inbox repository for managing inbox items
export class InboxRepository extends BaseRepository<InboxItem> {
    constructor() {
        super(STORES.INBOX);
    }
}
