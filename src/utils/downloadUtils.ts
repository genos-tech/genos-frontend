/**
 * Upgrade an `http://` URL to `https://` when the current page is served
 * over HTTPS. Media URLs are persisted into message bodies as absolute
 * URLs at upload time, and the backend (behind a TLS-terminating proxy)
 * sometimes stamps them with an `http://` scheme. On an HTTPS page the
 * browser blocks any `http://` subresource as Mixed Content, so the
 * `fetch()` download fails. Upgrading the scheme is the only way the
 * request can succeed — and it's safe, since the insecure variant would
 * be blocked regardless. Left untouched on plain-HTTP pages (e.g. local
 * dev against `http://localhost`).
 */
export const upgradeInsecureUrl = (url: string): string => {
    if (
        typeof window !== "undefined" &&
        window.location?.protocol === "https:" &&
        url.startsWith("http://")
    ) {
        return `https://${url.slice("http://".length)}`;
    }
    return url;
};

/**
 * Downloads a file from a URL using blob to ensure proper local download
 * instead of opening in a new tab
 */
export const downloadFile = async (rawUrl: string, filename?: string): Promise<void> => {
    const url = upgradeInsecureUrl(rawUrl);
    try {
        // Fetch the file as a blob to handle CORS and ensure proper download
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");

        const blob = await response.blob();

        // Extract proper filename from URL if not provided
        let finalFilename = filename;
        if (!finalFilename) {
            const urlParts = url.split("/");
            const urlFilename = urlParts[urlParts.length - 1];
            if (urlFilename && urlFilename.includes(".")) {
                finalFilename = decodeURIComponent(urlFilename);
            } else {
                // Determine file extension from blob type
                const extension = blob.type.split("/")[1] || "bin";
                finalFilename = `attachment.${extension}`;
            }
        }

        // Create blob URL and download
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL to free memory
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error("Download failed:", error);
        // Fallback to the original method if fetch fails
        const link = document.createElement("a");
        link.href = url;
        link.download = filename || "attachment";
        link.target = "_blank"; // This will open in new tab as fallback
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
