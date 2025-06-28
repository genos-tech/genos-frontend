import { Sheet } from "@mui/joy";

export const Header = () => {
    return (
        <Sheet
            sx={{
                alignItems: "center",
                justifyContent: "space-between",
                position: "fixed",
                top: 0,
                width: "100vw",
                height: "40px",
                zIndex: 100000,
                p: 2,
                gap: 1,
                borderBottom: "1px solid",
                borderColor: "background.level1",
                boxShadow: "sm",
            }}
        >
            hello
        </Sheet>
    );
};
