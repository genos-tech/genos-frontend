import { Badge } from "@mui/joy";
import React from "react";

interface CircleIconProps {
    number: number;
}
export const CircleIcon: React.FC<CircleIconProps> = ({ number }) => {
    return (
        <Badge
            badgeContent={number}
            color="primary"
            size="lg"
            variant="solid"
            sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
            }}
        />
    );
};
