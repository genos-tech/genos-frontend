import { useSyncExternalStore } from "react";

const QUERY = "(hover: none)";

const subscribe = (onChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) return () => {};
    const mq = window.matchMedia(QUERY);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
};

const getSnapshot = () =>
    typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches;

// True on a screen with no hover (a phone, a tablet): the input device, unlike `useIsMobile`
// which is about the viewport width. Use it where hover cannot be the way to reveal something.
export const useIsTouch = (): boolean => useSyncExternalStore(subscribe, getSnapshot, () => false);
