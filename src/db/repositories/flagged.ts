import { STORES } from "../config";
import { FlaggedMessage } from "../types";
import { BaseRepository } from "./base";

// Flagged repository for managing flagged messages
export class FlaggedRepository extends BaseRepository<FlaggedMessage> {
    constructor() {
        super(STORES.FLAGGED_MESSAGES);
    }
}
