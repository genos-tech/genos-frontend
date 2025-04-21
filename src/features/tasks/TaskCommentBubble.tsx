import React, { useEffect, useRef } from 'react';
import Box from '@mui/joy/Box';
import Stack from '@mui/joy/Stack';
import Typography from '@mui/joy/Typography';
import Card from '@mui/joy/Card';
import Avatar from '@mui/joy/Avatar';
import { useColorScheme } from '@mui/joy/styles';
import { TaskCommentProps } from "../../types";
import BnPreview from '../../components/richTextEditor/bnPreview';

type TaskCommentBubbleProps = {
  taskComments: TaskCommentProps[];
}

export default function TaskCommentBubble(props: TaskCommentBubbleProps) {
  const { taskComments } = props;
  const { mode } = useColorScheme();

  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  }, [taskComments]); // Re-scroll on content change


  return (
    <>
      {(taskComments.length === 0) && (<div>You can  add your comments here !!!</div>)}
      {(taskComments.length > 0) && (<>
        <Box
          ref={boxRef}
          className="custom-scrollbar"
          sx={{
            height: Math.min(taskComments.length * 120, 300),
            pb: '10px',
            overflowY: 'scroll',
            overflowX: 'hidden'
          }}>
          <Stack spacing={1}>
            {taskComments.map((comment, index) => {
              if (comment.commentBody[0].content.length > 0) {
                return (
                  <Box key={index}>
                    <Card sx={{ backgroundColor: mode === 'dark' ? 'grey' : 'rgb(217, 217, 217)' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar size="sm">{comment.senderName[0]}</Avatar>
                        <Typography level="title-md">{comment.senderName}</Typography>
                        <Typography
                          level="body-sm"
                          textColor="black"
                          sx={{ fontFamily: 'monospace', opacity: 0.7, pl: '5px' }}
                        >
                          {comment.sentAt}
                        </Typography>
                      </Stack>
                      <BnPreview
                        key={`${taskComments[0].taskId}-${comment.commentId}-${comment.sentAt}`}
                        content={comment.commentBody}
                        isSent={true}
                      />
                    </Card>
                  </Box>
                )
              }
            })}
          </Stack>
        </Box>
      </>)}
    </>
  );
}
