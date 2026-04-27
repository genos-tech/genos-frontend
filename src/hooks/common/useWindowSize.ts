import { useCallback, useEffect, useState } from "react";

const MIN_WIDTH = 768;
const MIN_HEIGHT = 500;

export const useWindowSize = () => {
    const checkSize = useCallback(
        () => window.innerWidth < MIN_WIDTH || window.innerHeight < MIN_HEIGHT,
        []
    );

    const [isTooSmall, setIsTooSmall] = useState(checkSize);

    useEffect(() => {
        const handleResize = () => setIsTooSmall(checkSize());
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [checkSize]);

    return isTooSmall;
};
