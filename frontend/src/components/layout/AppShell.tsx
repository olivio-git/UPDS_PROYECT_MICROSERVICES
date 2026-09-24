import { UserAvatar } from '@/components/atoms/UserAvatar';
import { BrandLogo } from '@/components/BrandLogo';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/keel/sidebar';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useAuthStore } from '@/modules/auth/services/authStore';
import CommandPalette from '@/modules/dashboard/components/CommandPalette';
import NotificationsSheet from '@/modules/dashboard/components/NotificationsSheet';
import { useNotifications } from '@/modules/dashboard/hooks/useNotifications';
import { activePath, menuForRole } from '@/navigation/menu';
import { Bell, LogOut, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  teacher: 'Docente',
  proctor: 'Supervisor',
  student: 'Estudiante',
};

/**
 * Application frame: keel's Sidebar (collapse, mobile sheet, keyboard
 * handling all come from the component) plus a slim top bar with the
 * command palette trigger, theme toggle and notifications. Every screen
 * renders inside the scrolling <main> — the sidebar and header never scroll.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, remove } = useNotifications();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const groups = useMemo(() => menuForRole(user?.role), [user?.role]);
  const current = activePath(pathname, groups);
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Usuario';

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <SidebarProvider className="h-dvh bg-background text-foreground">
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-1 py-1">
            <BrandLogo className="h-7 shrink-0" markOnly />
            <span className="truncate text-sm font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              Evaluación
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          {groups.map((group, i) => (
            <SidebarGroup key={group.label ?? `group-${i}`}>
              {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarMenu>
                {group.items.map(({ path, label, icon: Icon, hint }) => (
                  <SidebarMenuItem key={path}>
                    <SidebarMenuButton
                      render={<Link to={path} />}
                      isActive={current === path}
                      tooltip={hint ?? label}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <UserAvatar avatarUrl={user?.profile?.avatarUrl} firstName={user?.firstName} lastName={user?.lastName} size="sm" />
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{name}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="rounded-lg p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex h-dvh min-w-0 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3 shadow-sm">
          <SidebarTrigger />

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px] sm:inline">Ctrl+K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle size="sm" />
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`}
              className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-muted/30">{children}</main>
      </SidebarInset>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <NotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={remove}
      />
    </SidebarProvider>
  );
}
