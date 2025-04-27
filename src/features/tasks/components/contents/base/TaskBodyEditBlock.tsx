import { Box, Stack } from "@mui/joy";
import { PartialBlock } from "@blocknote/core";

import BnTaskEditor from '../../../../../components/blockNote/bnTaskEditor'

type TaskBodyEditBlockProps = {
    setBody: (value: PartialBlock[]) => void;
}
export const TaskBodyEditBlock = (props: TaskBodyEditBlockProps) => {
    const { setBody } = props;
    return (
        <Stack direction={"column"} sx={{ width: '100%' }}>
            <Box sx={{ mt: 2 }}>
                <div className="md-content">
                    <BnTaskEditor
                        setBody={setBody}
                    />
                </div>
            </Box>
        </Stack>
    )
}