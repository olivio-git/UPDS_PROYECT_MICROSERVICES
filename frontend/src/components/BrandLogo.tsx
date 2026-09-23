import { cn } from '@/lib/utils';
import logoColor from '@/assets/images/logocba-color.webp';
import logoWhite from '@/assets/images/logo.webp';

interface BrandLogoProps {
  /** Height utility, e.g. "h-16". */
  className?: string;
  /**
   * Cuts the "Centro Boliviano Americano" line baked into the colour file.
   * Use it where the mark sits next to a text label and would only be a
   * blur — the sidebar, the student header.
   */
  markOnly?: boolean;
}

/**
 * The CBA mark. There are two files and each one only works on one kind of
 * background: logo.webp is white (dark surfaces) and logocba-color.webp is
 * the navy and red version (light surfaces). The white file was being used
 * on the light sidebar and the light auth card, which is why the logo looked
 * like an empty gap there.
 */
export function BrandLogo({ className, markOnly = false }: BrandLogoProps) {
  const img = (src: string, hidden: string, alt: string) => (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : 'true'}
      className={cn(
        'w-auto',
        hidden,
        markOnly ? 'h-[145%] object-cover object-top' : 'h-full',
      )}
    />
  );

  return (
    <span className={cn('inline-flex items-center overflow-hidden', className)}>
      {img(logoColor, 'dark:hidden', 'CBA Tarija')}
      {img(logoWhite, 'hidden dark:block', '')}
    </span>
  );
}
