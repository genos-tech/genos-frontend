import * as React from 'react';
import Avatar from '@mui/joy/Avatar';
import Box from '@mui/joy/Box';
import IconButton from '@mui/joy/IconButton';
import Stack from '@mui/joy/Stack';
import Sheet from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';
import Tooltip from '@mui/joy/Tooltip';
import CelebrationOutlinedIcon from '@mui/icons-material/CelebrationOutlined';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import AvatarWithStatus from '../utils/avatarWithStatus';
import { ThreadMessageProps } from '../../types';

type ChatBubbleProps = ThreadMessageProps & {
  variant: 'sent' | 'received';
};

function extractHHMM(ts: string) {
  return ts.split(' ')[1].slice(0, 5);
}


export default function ThreadBubble(props: ChatBubbleProps) {
  const { variant,
    content,
    tsSent,
    attachment = undefined,
    sender } = props;
  const isSent = variant === 'sent';
  const [isLiked, setIsLiked] = React.useState<boolean>(false);
  const [isCelebrated, setIsCelebrated] = React.useState<boolean>(false);

  const _tsSent = extractHHMM(tsSent)

  return (
    <Box sx={{
      maxWidth: '90%',
      minWidth: 'auto',
      whiteSpace: 'normal',
      wordBreak: 'break-word'
    }}>

      {attachment ? (
        <Sheet
          variant="outlined"
          sx={[
            {
              px: 1.75,
              py: 1.25,
              borderRadius: 'lg',
            },
            isSent ? { borderTopRightRadius: 0 } : { borderTopRightRadius: 'lg' },
            isSent ? { borderTopLeftRadius: 'lg' } : { borderTopLeftRadius: 0 },
          ]}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar color="primary" size="lg">
              <InsertDriveFileRoundedIcon />
            </Avatar>
            <div>
              <Typography sx={{ fontSize: 'sm' }}>{attachment.fileName}</Typography>
              <Typography level="body-sm">{attachment.size}</Typography>
            </div>
          </Stack>
        </Sheet>
      ) : (
        <Box
          sx={{ position: 'relative' }}
        >
          <Sheet
            color={isSent ? 'primary' : 'neutral'}
            variant={isSent ? 'solid' : 'soft'}
            sx={[
              {
                p: 1.25,
                borderRadius: 'lg',
              },
              isSent
                ? {
                  borderTopRightRadius: 0,
                }
                : {
                  borderTopRightRadius: 'lg',
                },
              isSent
                ? {
                  borderTopLeftRadius: 'lg',
                }
                : {
                  borderTopLeftRadius: 0,
                },
              isSent
                ? {
                  backgroundColor: 'var(--joy-palette-primary-solidBg)',
                }
                : {
                  backgroundColor: 'background.body',
                },
            ]}
          >

            <Stack direction="row" spacing={1.5}>
              <Box sx={{ flex: 1 }}>
                <AvatarWithStatus
                  online={sender.online}
                  src={sender.avatarImgPath}
                />
              </Box>
              <Box sx={{ flex: 20 }}>

                <Stack direction="row" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      level="body-xs"
                      sx={[
                        {
                          lineHeight: 2
                        },
                        isSent
                          ? {
                            color: 'var(--joy-palette-common-white)',
                          }
                          : {
                            color: 'var(--joy-palette-text-primary)',
                          },
                      ]}
                    >
                      {sender.userName} &nbsp;  {_tsSent}
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: 'right' }}>
                    <Tooltip title="Like" size='sm'>
                      <IconButton
                        size="sm"
                        onClick={() => setIsLiked((prevState) => !prevState)}
                        sx={{
                          backgroundColor: "transparent", // No background
                          outline: "none", // No focus outline
                          padding: 0, // Remove extra space
                          "&:hover": { backgroundColor: "transparent" }, // No hover effect
                          "&:focus, &:focusVisible": { outline: "none", boxShadow: "none" }, // No focus effect
                          "&:active": { transform: "none" }, // Prevents click animation (scaling effect)
                          transition: "none", // No color fade animation
                        }}
                      >
                        {isLiked ? (
                          <FavoriteIcon sx={{ color: "#FF0000", transition: "none" }} /> // Red when liked
                        ) : (
                          <FavoriteBorderIcon sx={{ color: "#888888", transition: "none" }} /> // Gray when not liked
                        )}
                      </IconButton>
                    </Tooltip>
              </Box>

                </Stack>

                <Typography
                  level="body-sm"
                  sx={[
                    {
                      lineHeight: 2
                    },
                    isSent
                      ? {
                        color: 'var(--joy-palette-common-white)',
                      }
                      : {
                        color: 'var(--joy-palette-text-primary)',
                      },
                  ]}
                >
                  {content}
                </Typography>
              </Box>
            </Stack>
          </Sheet>
        </Box>
      )}
    </Box>
  );
}
