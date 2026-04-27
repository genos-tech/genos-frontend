const COLLAB_COLORS = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E9",
    "#F0B27A",
    "#82E0AA",
    "#F1948A",
    "#AED6F1",
    "#A3E4D7",
    "#FAD7A0",
];

export function getUserColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = (hash * 31 + userId.charCodeAt(i)) | 0;
    }
    return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}
