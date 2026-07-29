import { useSyncExternalStore } from "react";

// Chromium's install-prompt event — not in TypeScript's DOM lib.
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// `beforeinstallprompt` fires once, on Chromium's own schedule — often
// before React (let alone the authenticated app shell) has mounted. A
// listener attached inside a component effect would usually miss it, so
// the event is captured at module scope and components subscribe to the
// captured value via useSyncExternalStore.
let capturedPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((cb) => cb());

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (event) => {
        // Suppress Chrome's own mini-infobar; the InstallBanner owns the UX.
        event.preventDefault();
        capturedPrompt = event as BeforeInstallPromptEvent;
        notify();
    });
    window.addEventListener("appinstalled", () => {
        capturedPrompt = null;
        notify();
    });
}

const subscribe = (cb: () => void): (() => void) => {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
};

/** Already running as an installed app (Android/desktop PWA or iOS home-screen). */
export const isStandaloneDisplay = (): boolean => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    // iOS Safari's pre-standard flag, still the only signal there.
    return (navigator as Navigator & { standalone?: boolean }).standalone === true;
};

/**
 * iOS has no install-prompt API, so its affordance is instructions
 * (Share → Add to Home Screen) instead of a button. iPadOS ≥13 reports
 * itself as MacIntel; the touch-point check tells it apart from a Mac.
 */
export const isIOSDevice = (): boolean => {
    if (typeof navigator === "undefined") return false;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
    return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
};

/**
 * Install-to-home-screen state. `canPrompt` is true only on browsers that
 * delivered `beforeinstallprompt` (Chromium); `promptInstall` shows the
 * native dialog and resolves true when the user accepts.
 */
export const useInstallPrompt = () => {
    const prompt = useSyncExternalStore(
        subscribe,
        () => capturedPrompt,
        () => null
    );

    const promptInstall = async (): Promise<boolean> => {
        if (!capturedPrompt) return false;
        const current = capturedPrompt;
        // One-shot: a BeforeInstallPromptEvent can only prompt() once.
        capturedPrompt = null;
        notify();
        try {
            await current.prompt();
            const choice = await current.userChoice;
            return choice.outcome === "accepted";
        } catch {
            return false;
        }
    };

    return { canPrompt: prompt !== null, promptInstall };
};
