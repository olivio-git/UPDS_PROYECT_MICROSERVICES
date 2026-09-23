import { UserAvatar } from '@/components/atoms/UserAvatar';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/modules/auth/services/authStore';
import CommandPalette from '@/modules/dashboard/components/CommandPalette';
import NotificationsSheet from '@/modules/dashboard/components/NotificationsSheet';
import { useNotifications } from '@/modules/dashboard/hooks/useNotifications';
import { activePath, menuForRole } from '@/navigation/menu';
import { Bell, LogOut, Menu, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from '@/components/BrandLogo';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  teacher: 'Docente',
  proctor: 'Supervisor',
  student: 'Estudiante',
};

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const role = useAuthStore((s) => s.user?.role);
  const groups = useMemo(() => menuForRole(role), [role]);
  const current = activePath(pathname, groups);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Navegación principal">
      {groups.map((group, i) => (
        <div key={group.label ?? `group-${i}`} className="space-y-1">
          {group.label && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
          )}
          {group.items.map(({ path, label, icon: Icon, hint }) => {
            const active = current === path;
            return (
              <Link
                key={path}
                to={path}
                title={hint}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarUser() {
  const { user, logout } = useAuthStore();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Usuario';

  return (
    <div className="border-t border-border p-3 flex items-center gap-2.5">
      <UserAvatar avatarUrl={user?.profile?.avatarUrl} firstName={user?.firstName} lastName={user?.lastName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</p>
      </div>
      <button
        type="button"
        onClick={() => logout()}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Application frame: a labelled sidebar grouped by task, and a slim top bar
 * with search, theme and notifications. Every screen renders inside it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, remove } = useNotifications();
  const { pathname } = useLocation();

  useEffect(() => setMobileOpen(false), [pathname]);

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
    <div className="min-h-screen bg-background flex">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-60 bg-card border-r border-border flex flex-col transition-transform lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
          <BrandLogo className="h-7" markOnly />
          <span className="text-sm font-semibold text-foreground truncate">Evaluación</span>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
            className="ml-auto p-1 rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SidebarNav onNavigate={() => setMobileOpen(false)} />
        <SidebarUser />
      </aside>

      <div className="flex-1 min-w-0 lg:ml-60 flex flex-col">
        <header className="h-14 shrink-0 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20 flex items-center gap-2 px-4">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Buscar</span>
            <kbd className="hidden sm:inline text-[10px] font-mono bg-background border border-border rounded px-1 py-0.5">Ctrl+K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle size="sm" />
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ''}`}
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <NotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={remove}
      />
    </div>
  );
}
