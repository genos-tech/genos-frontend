import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

/**
 * Tell the socket server when the projects I belong to changed (MIP-1350).
 *
 * The server puts a socket in the room of every project its user belongs to, but
 * only when it connects. A project joined afterwards (approved, added by an owner,
 * created here) had no room until a reconnect, so its live events never arrived;
 * one I was removed from kept its room and went on delivering. So when the SET of
 * projects I have joined changes, ask the server to check again.
 *
 * The ask carries no project ids: the server re-reads my projects from the API
 * with my own token, so the client can only say "check again", never name a room.
 */

/** The ids of the projects I have joined, in a stable order, as one string. */
export const joinedProjectKey = (
    projects: ReadonlyArray<{ projectId: number; isJoined?: boolean }>
): string =>
    projects
        .filter((project) => project.isJoined === true)
        .map((project) => project.projectId)
        .sort((a, b) => a - b)
        .join(",");

export const useProjectRoomSync = (
    socket: Pick<Socket, "connected" | "emit"> | null,
    projects: ReadonlyArray<{ projectId: number; isJoined?: boolean }>
): void => {
    const key = joinedProjectKey(projects);
    // The set the server last saw for THIS socket. A socket fetched the list itself
    // when it connected, so the first value seen for a socket is the baseline and
    // asks for nothing.
    const seen = useRef<{ socket: unknown; key: string } | null>(null);

    useEffect(() => {
        if (!socket) {
            seen.current = null;
            return;
        }
        const previous = seen.current;
        seen.current = { socket, key };
        if (previous === null || previous.socket !== socket) return;
        if (previous.key === key) return;
        // Not connected: its connect will fetch the list itself.
        if (socket.connected) socket.emit("sync_project_rooms");
    }, [socket, key]);
};
