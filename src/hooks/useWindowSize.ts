import { useEffect, useState } from "react";

// Window size hook, rAF-throttled.
//
// Without throttling, "resize" can fire hundreds of times per second while a
// user drags the window corner. Each fire triggers a setState → re-render in
// every consumer (panel layouts, sidebars, modals, etc.). With requestAnimationFrame
// coalescing we cap updates at one per animation frame (~60 Hz on most
// displays), aligning the React commit with the browser's repaint cadence
// and eliminating wasted work on intermediate sizes.
export const useWindowSize = () => {
    const [size, setSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });

    useEffect(() => {
        let rafId: number | null = null;

        const handleResize = () => {
            if (rafId !== null) return;
            rafId = window.requestAnimationFrame(() => {
                rafId = null;
                setSize({ width: window.innerWidth, height: window.innerHeight });
            });
        };

        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
            if (rafId !== null) window.cancelAnimationFrame(rafId);
        };
    }, []);

    return size;
};
