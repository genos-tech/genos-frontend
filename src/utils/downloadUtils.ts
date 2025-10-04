/**
 * Downloads a file from a URL using blob to ensure proper local download
 * instead of opening in a new tab
 */
export const downloadFile = async (url: string, filename?: string): Promise<void> => {
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
