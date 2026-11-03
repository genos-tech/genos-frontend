import { useMemo, useRef } from "react";

import type { AvatarContextValue } from "./AvatarContext";

/**
 * The value `AvatarContextProvider` hands to every avatar in the app, kept
 * referentially stable (MIP-958).
 *
 * `AppBody` renders about 13 times per task click. An inline
 * `value={{ ... }}` was a new object each time, so every consumer re-rendered
 * 13 times for a click that changed none of the fields it reads.
 *
 * `useCM` and `useUISM` are the exception: they are the chat and UI managers,
 * new objects on every `AppBody` render, so listing them as dependencies would
 * defeat the memo. They are read through a ref by getters instead. The only
 * reader, `UserAvatar`, passes them on to the profile card it opens, and it
 * renders when the card opens, so it sees the managers from the latest render.
 */
export const useAvatarContextValue = (input: AvatarContextValue): AvatarContextValue => {
    const managersRef = useRef({ useCM: input.useCM, useUISM: input.useUISM });
    managersRef.current = { useCM: input.useCM, useUISM: input.useUISM };

    const { myself, setMyself, setTeamMemberProfiles, socket, teamMemberProfiles } = input;
    const { selfNotificationsPaused } = input;

    return useMemo<AvatarContextValue>(
        () => ({
            myself,
            setMyself,
            setTeamMemberProfiles,
            socket,
            teamMemberProfiles,
            get useCM() {
                return managersRef.current.useCM;
            },
            get useUISM() {
                return managersRef.current.useUISM;
            },
            selfNotificationsPaused,
        }),
        [
            myself,
            setMyself,
            setTeamMemberProfiles,
            socket,
            teamMemberProfiles,
            selfNotificationsPaused,
        ]
    );
};
