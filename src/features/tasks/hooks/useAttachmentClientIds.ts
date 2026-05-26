import { useCallback, useRef } from "react";

/**
 * Allocates monotonically-decreasing negative `attachment_id`s for
 * unsaved client-side attachments. The backend ignores these — see
 * `uploadTaskAttachments.ts` where the FormData `attachment_id` is
 * hard-coded to "-1" — so they only need to be unique within the
 * component instance's lifetime.
 *
 * Using a ref instead of state avoids the stale-closure bug the old
 * `numOfUploadingFiles` setState pattern hit when two file additions
 * landed in the same render batch.
 */
export const useAttachmentClientIds = () => {
    const nextRef = useRef<number>(-1);

    const nextId = useCallback((): number => {
        const id = nextRef.current;
        nextRef.current -= 1;
        return id;
    }, []);

    return nextId;
};
