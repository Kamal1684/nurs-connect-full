import { cn } from '@/lib/utils';

interface LogoIconProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

export function LogoIcon({ className, size = 'sm' }: LogoIconProps) {
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 overflow-hidden shadow-xs select-none rounded-[22%]',
        sizeClasses[size],
        className
      )}
    >
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full block"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ncLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0E6EE8" />
            <stop offset="100%" stopColor="#0056B3" />
          </linearGradient>
        </defs>
        {/* Background rounded rect */}
        <rect width="100" height="100" rx="24" fill="url(#ncLogoGrad)" />
        {/* ECG pulse waveform line exactly matching the user's icon */}
        <path
          d="M 18 50 L 34 50 L 46 25 L 57 75 L 68 46 L 76 51 L 82 50"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="9.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

interface LogoProps {
  className?: string;
  iconSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  textClassName?: string;
  subtitle?: string;
  dark?: boolean;
}

export function Logo({
  className,
  iconSize = 'sm',
  textClassName,
  subtitle,
  dark = false,
}: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoIcon size={iconSize} />
      <div className="flex flex-col">
        <span
          className={cn(
            'font-bold tracking-tight leading-none',
            dark ? 'text-white' : 'text-[#082F63]',
            textClassName || (iconSize === 'xs' ? 'text-sm' : iconSize === 'sm' ? 'text-base' : iconSize === 'md' ? 'text-lg' : 'text-xl')
          )}
        >
          NurseConnect
        </span>
        {subtitle && (
          <span
            className={cn(
              'text-[11px] leading-none mt-1',
              dark ? 'text-blue-200/70' : 'text-slate-500'
            )}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default Logo;
