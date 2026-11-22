import { useEffect } from "react";

/**
 * Sets `document.title` for the life of the calling component and restores the previous title on
 * unmount (MIP-1826). Title only: no canonical / hreflang / Open Graph tags (those are
 * `useDocumentMeta`, for the public marketing pages). A screen reader announces the title first
 * when a page loads, so a constant "Genos" on every screen tells the person nothing.
 */
export function useDocumentTitle(title: string): void {
    useEffect(() => {
        const previous = document.title;
        document.title = title;
        return () => {
            document.title = previous;
        };
    }, [title]);
}
