import { FlaggedMessageProps } from "../../types/chat";
import { STORES } from "../config";
import { BaseRepository } from "./base";

// Flagged repository for managing flagged messages
export class FlaggedRepository extends BaseRepository<FlaggedMessageProps> {
    constructor() {
        super(STORES.FLAGGED_MESSAGES);
    }
}
