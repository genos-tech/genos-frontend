export const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
};

export const createFileDropHandler = (onFilesDropped: (files: File[]) => void) => {
    return (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        // If the drop landed inside the BlockNote editor, let BlockNote handle it natively
        const target = event.target as HTMLElement;
        if (target.closest(".bn-editor") || target.closest(".bn-container")) {
            return;
        }

        const droppedFiles = Array.from(event.dataTransfer.files);
        if (droppedFiles.length > 0) {
            onFilesDropped(droppedFiles);
        }
    };
};
