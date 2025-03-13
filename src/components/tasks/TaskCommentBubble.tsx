import Box from '@mui/joy/Box';
import Stack from '@mui/joy/Stack';
import Typography from '@mui/joy/Typography';
import Card from '@mui/joy/Card';
import Avatar from '@mui/joy/Avatar';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { useColorScheme } from '@mui/joy/styles';

function getCurrentTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export default function TaskCommentBubble() {
  const { mode } = useColorScheme();

  return (
    <Box
      className="custom-scrollbar"
      sx={{
        height: 300,
        pb: '10px',
        overflowY: 'scroll',
        overflowX: 'hidden'
      }}>
      <Stack spacing={1}>
        <Card sx={{ backgroundColor: mode === 'dark' ? 'grey' : 'lightgrey' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar size="sm">K</Avatar>
            <Typography level="title-md">Ken</Typography>
            <Typography
              level="body-sm"
              textColor="black"
              sx={{ fontFamily: 'monospace', opacity: 0.7, pl: '5px' }}
            >
              {getCurrentTimestamp()}
            </Typography>
          </Stack>
          <MarkdownPreview
            className="markdown-preview"
            source={"<p>Hello</p><p>Your code is fine enough</p>"}
            style={{
              backgroundColor: 'transparent',
              color: 'black'
            }}
          />
        </Card>
        <Card sx={{ backgroundColor: mode === 'dark' ? 'grey' : 'lightgrey' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar size="sm">K</Avatar>
            <Typography level="title-md">Ken</Typography>
            <Typography
              level="body-sm"
              textColor="black"
              sx={{ fontFamily: 'monospace', opacity: 0.7, pl: '5px' }}
            >
              {getCurrentTimestamp()}
            </Typography>
          </Stack>
          <MarkdownPreview
            className="markdown-preview"
            source={"<p>Hello</p><p>Your code is fine enough</p>"}
            style={{
              backgroundColor: 'transparent',
              color: 'black'
            }}
          />
        </Card>

        <Card sx={{ backgroundColor: mode === 'dark' ? 'grey' : 'lightgrey' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar size="sm">K</Avatar>
            <Typography level="title-md">Ken</Typography>
            <Typography
              level="body-sm"
              textColor="black"
              sx={{ fontFamily: 'monospace', opacity: 0.7, pl: '5px' }}
            >
              {getCurrentTimestamp()}
            </Typography>
          </Stack>
          <MarkdownPreview
            className="markdown-preview"
            source={"<p>Hello</p><p>Your code is fine enough</p>"}
            style={{
              backgroundColor: 'transparent',
              color: 'black'
            }}
          />
        </Card>
      </Stack>
    </Box>
  );
}
