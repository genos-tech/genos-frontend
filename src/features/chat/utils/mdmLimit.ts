/** The most people a multi-person DM holds, the creator included (MIP-2549). The server
 *  enforces it (`origin/services/mdm_members.py`); keep the two in step. Group chats have no
 *  limit. */
export const MDM_MAX_MEMBERS = 10;

/** Whether an add or create failed because of that limit (the server's refusal sentence). */
export const isMdmLimitError = (error: unknown): boolean =>
    error instanceof Error && error.message.includes("multi-person DM can have at most");
