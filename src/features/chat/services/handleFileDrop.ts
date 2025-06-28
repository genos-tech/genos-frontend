export const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    handleFiles(droppedFiles);
};

export const handleFiles = (selectedFiles: File[]) => {
    selectedFiles.forEach((file) => {
        const fileType = file.type;
        if (fileType === "image/jpeg" || fileType === "image/png") {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    const img = new Image();
                    img.src = e.target.result as string;
                    img.onload = () => {};
                }
            };
            reader.readAsDataURL(file);
        } else {
            const fileURL = URL.createObjectURL(file);
        }
    });
};
