/** The key in groups of four, the way an authenticator app shows it. */
export const groupKey = (secret: string): string => secret.replace(/(.{4})/g, "$1 ").trim();
