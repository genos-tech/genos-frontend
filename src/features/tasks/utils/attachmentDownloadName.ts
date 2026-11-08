/**
 * The file name a zoomed attachment image downloads as: `image-<timestamp>` plus the
 * extension of the attachment it came from (MIP-1194; it used to have none, so the file
 * would not open with the right app). An attachment with no usable extension gets `.png`,
 * which is what the lightbox's own default download writes.
 */
export const attachmentDownloadName = (attachmentName: string, timestamp: string): string => {
    const extension = /\.[A-Za-z0-9]{1,8}$/.exec(attachmentName.trim())?.[0];
    return `image-${timestamp}${extension ?? ".png"}`;
};
