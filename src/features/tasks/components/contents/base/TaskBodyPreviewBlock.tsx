import { Box, Stack } from "@mui/joy";
import { PartialBlock } from "@blocknote/core";

import { BnTaskPreview } from '../../../../../components/blockNote/bnTaskPreview'

type TaskBodyPreviewBlockProps = {
    body: PartialBlock[] | null;
    setBody: (value: PartialBlock[]) => void;
    setTaskUpdated: (value: boolean) => void;
}
export const TaskBodyPreviewBlock = (props: TaskBodyPreviewBlockProps) => {
    const { body, setBody, setTaskUpdated } = props;
    return (
        <Stack direction={"column"} sx={{ width: '100%' }}>
            <Box sx={{ mt: 2 }}>
                <BnTaskPreview
                    body={body || []}
                    setBody={setBody}
                    setTaskUpdated={setTaskUpdated}
                />
            </Box>
        </Stack>
    )
}