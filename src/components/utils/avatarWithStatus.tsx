import Badge from '@mui/joy/Badge';
import Avatar, { AvatarProps } from '@mui/joy/Avatar';

type AvatarWithStatusProps = AvatarProps & {
  chatName: string;
  online?: boolean;
};
export const AvatarWithStatus = (props: AvatarWithStatusProps) => {
  const { online = false, chatName, ...other } = props;
  return (
    <div>
      <Badge
        color={online ? 'success' : 'neutral'}
        variant={'solid'}
        size="sm"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        badgeInset="4px 4px"
      >
        <Avatar size="sm" {...other} >
          {chatName[0]}
        </Avatar>
      </Badge>
    </div>
  );
}
