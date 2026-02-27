'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
            icon: 'group-[.toast]:text-foreground',
        },
        style: {
          backgroundColor: '#1E293B', // use surface color variable
          color: '#E2E8F0', // use text color variable
          border: '.5px solid #111c2d', // use border color variable
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
