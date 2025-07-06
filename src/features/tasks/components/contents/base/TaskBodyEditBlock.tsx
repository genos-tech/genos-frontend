import { Box, Stack } from "@mui/joy";
import { PartialBlock } from "@blocknote/core";

import { BnTaskPreview } from "../../../../../components/blockNote/bnTaskPreview";

type TaskBodyEditBlockProps = {
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
};
export const TaskBodyEditBlock = (props: TaskBodyEditBlockProps) => {
    const { body, setBody } = props;
    return (
        <Stack direction={"column"} sx={{ width: "100%" }}>
            <Box sx={{ mt: 2 }}>
                <div className="md-content">
                    <BnTaskPreview body={body || []} setBody={setBody} />
                </div>
            </Box>
        </Stack>
    );
};
