import { useCallback, useEffect, useRef, useState } from "react";

// One-shot tab-index init for the task / milestone preview.
//
// Comments and notes load on separate async effects; attachments arrive
// with the entity itself. We wait until BOTH async fetches have reported
// back for the currently-opened entity, then set the tab once and lock.
// Subsequent comment / note / attachment changes don't move the user
// away from the tab they're reading.
//
// Priority: comments > 0 → 0, else notes > 0 → 1, else files > 0 → 2,
// else 0 (Comments).
export const useInitialTabIndex = (entityId: number | string | null | undefined) => {
    const [tabIndex, setTabIndex] = useState(0);
    const initializedForIdRef = useRef<number | string | null>(null);
    const statusRef = useRef<{
        id: number | string | null;
        commentsLoaded: boolean;
        notesLoaded: boolean;
        commentCount: number;
        noteCount: number;
        fileCount: number;
    }>({
        id: null,
        commentsLoaded: false,
        notesLoaded: false,
        commentCount: 0,
        noteCount: 0,
        fileCount: 0,
    });

    useEffect(() => {
        statusRef.current = {
            id: entityId ?? null,
            commentsLoaded: false,
            notesLoaded: false,
            commentCount: 0,
            noteCount: 0,
            fileCount: statusRef.current.fileCount,
        };
    }, [entityId]);

    const tryInitialize = useCallback(() => {
        const s = statusRef.current;
        if (s.id == null) return;
        if (initializedForIdRef.current === s.id) return;
        if (!s.commentsLoaded || !s.notesLoaded) return;
        setTabIndex(s.commentCount > 0 ? 0 : s.noteCount > 0 ? 1 : s.fileCount > 0 ? 2 : 0);
        initializedForIdRef.current = s.id;
    }, []);

    const markCommentsLoaded = useCallback(
        (count: number) => {
            if (statusRef.current.id !== (entityId ?? null)) return;
            statusRef.current.commentsLoaded = true;
            statusRef.current.commentCount = count;
            tryInitialize();
        },
        [entityId, tryInitialize]
    );

    const markNotesLoaded = useCallback(
        (count: number) => {
            if (statusRef.current.id !== (entityId ?? null)) return;
            statusRef.current.notesLoaded = true;
            statusRef.current.noteCount = count;
            tryInitialize();
        },
        [entityId, tryInitialize]
    );

    const reportFileCount = useCallback((count: number) => {
        statusRef.current.fileCount = count;
    }, []);

    return { tabIndex, setTabIndex, markCommentsLoaded, markNotesLoaded, reportFileCount };
};
