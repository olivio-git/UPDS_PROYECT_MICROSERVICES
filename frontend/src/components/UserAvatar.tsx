import { Avatar, AvatarFallback, AvatarImage } from '@/components/keel/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  avatarUrl?: string | null;
  firstName?: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-[72px] text-xl',
  xl: 'size-24 text-2xl',
};

export function UserAvatar({ avatarUrl, firstName = '', lastName = '', size = 'md', className }: UserAvatarProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={`${firstName} ${lastName}`} />}
      <AvatarFallback className="bg-[#F0003C] font-bold text-white text-[length:inherit]">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
