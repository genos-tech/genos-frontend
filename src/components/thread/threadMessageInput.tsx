import * as React from 'react';
import Tooltip from '@mui/joy/Tooltip';
import Button from '@mui/joy/Button';
import FormControl from '@mui/joy/FormControl';
import Textarea from '@mui/joy/Textarea';
import { IconButton, Stack } from '@mui/joy';

import FormatBoldRoundedIcon from '@mui/icons-material/FormatBoldRounded';
import FormatItalicRoundedIcon from '@mui/icons-material/FormatItalicRounded';
import StrikethroughSRoundedIcon from '@mui/icons-material/StrikethroughSRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import CodeIcon from '@mui/icons-material/Code';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import CallIcon from '@mui/icons-material/Call';
import AddLinkIcon from '@mui/icons-material/AddLink';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import TerminalIcon from '@mui/icons-material/Terminal';
import SendRoundedIcon from '@mui/icons-material/SendRounded';

export type ThreadMessageInputProps = {
  onSubmit: (message: string) => void;
};

export default function ThreadMessageInput(props: ThreadMessageInputProps) {
  const { onSubmit } = props;
  const [textAreaValue, setTextAreaValue] = React.useState('');
  const textAreaRef = React.useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (textAreaValue.trim() !== '') {
      onSubmit(textAreaValue.trim());
      setTextAreaValue('');
    }
  };

  return (
    <FormControl>
      <Textarea
        placeholder="Type something here…"
        aria-label="Message"
        ref={textAreaRef}
        onChange={(event) => {
          setTextAreaValue(event.target.value);
        }}
        value={textAreaValue}
        minRows={3}
        maxRows={10}
        endDecorator={
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              flexGrow: 1,
              py: 1,
              pr: 1,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <div>
              <Tooltip title="Mention" size='sm'>
                <IconButton size="sm" variant="plain" color="neutral">
                  <AlternateEmailIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Bold" size='sm'>
                <IconButton size="sm" variant="plain" color="neutral">
                  <FormatBoldRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Italic" size='sm'>
                <IconButton size="sm" variant="plain" color="neutral">
                  <FormatItalicRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Strikethrough" size='sm'>
                <IconButton size="sm" variant="plain" color="neutral">
                  <StrikethroughSRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Bullet" size='sm'>
                <IconButton size="sm" variant="plain" color="neutral">
                  <FormatListBulletedRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Quote" size='sm'>
                <IconButton size="sm" variant="plain" color="neutral">
                  <FormatQuoteIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Link" size='sm'>
                <IconButton size="sm" variant="plain" color="neutral">
                  <AddLinkIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Code" size='sm'>
                <IconButton size="sm" variant="plain" color="neutral">
                  <CodeIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Code Block" size='sm'>
                <IconButton size="sm" variant="plain" color="neutral">
                  <TerminalIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Call" size='sm'>
                <IconButton size="sm" variant="plain" color="neutral">
                  <CallIcon />
                </IconButton>
              </Tooltip>
            </div>
            <Button
              size="sm"
              color="primary"
              sx={{ alignSelf: 'center', borderRadius: 'sm' }}
              endDecorator={<SendRoundedIcon />}
              onClick={handleClick}
            >
              Send
            </Button>
          </Stack>
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            handleClick();
          }
        }}
        sx={{
          '& textarea:first-of-type': {
            minHeight: 72,
          },
        }}
      />
    </FormControl>
  );
}
