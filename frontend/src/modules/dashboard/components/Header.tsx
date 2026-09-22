import { Button } from '@/components/atoms/button';
import { UserAvatar } from '@/components/atoms/UserAvatar';
import { useAuthStore } from '@/modules/auth/services/authStore';
import { protectedRoutes } from '@/navigation/Protected.Route';
import { notificationService } from '@/services/notifications/notificationService';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import { authSDK } from '@/services/sdk-simple-auth';
import axios from 'axios';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  Info,
  LogOut,
  Menu,
  Search,
  Settings,
  Trash2,
  User,
  X,
} from 'lucide-react';
import NotificationsSheet from './NotificationsSheet';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import CommandPalette from './CommandPalette';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'exam';
}

const Header = () => {
  const { user, logout, isAuthenticated } = useAuthStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userForceUpdate, setUserForceUpdate] = useState(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAllNotificationsOpen, setIsAllNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    // {
    //     id: "1",
    //     title: "Nuevo Examen Disponible",
    //     message: "El examen de Cambridge B2 está disponible para tomar",
    //     time: "Hace 5 min",
    //     read: false,
    //     type: "exam"
    // },
    // {
    //     id: "2",
    //     title: "Resultado Publicado",
    //     message: "Tu resultado del examen IELTS Academic ya está disponible",
    //     time: "Hace 1h",
    //     read: false,
    //     type: "success"
    // },
    // {
    //     id: "3",
    //     title: "Recordatorio",
    //     message: "Tu próximo examen es mañana a las 10:00 AM",
    //     time: "Hace 2h",
    //     read: true,
    //     type: "warning"
    // }
  ]);

  // Notification handler reference for cleanup
  const notifHandlerRef = useRef<((payload: any) => void) | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Forzar re-render cuando cambie el estado de autenticación
  useEffect(() => {
    if (isAuthenticated && user) {
      setUserForceUpdate(prev => prev + 1);
      // Load notifications from API
      (async () => {
        try {
          const res = await notificationService.getInAppNotifications({
            recipientId: user.id,
            onlyUnread: false,
            limit: 20,
          });
          if (res?.success && Array.isArray(res.data)) {
            const normalized = res.data.map((n: any) => ({
              id: n._id,
              title: n.content?.title || 'Notificación',
              message: n.content?.body || n.content?.message || '',
              time: new Date(n.createdAt).toLocaleString(),
              read: !!n.read,
              type: (n.type as any) || 'info',
            }));
            setNotifications(normalized);
          }
        } catch (err) {
          console.error('Error loading notifications', err);
        }
      })();

      // Connect shared notification socket and listen for real-time notifications
      (async () => {
        try {
          const handler = (payload: any) => {
            const n = {
              id: payload._id || payload.id,
              title: payload.content?.title || payload.title || 'Notificación',
              message:
                payload.content?.body ||
                payload.content?.message ||
                payload.message ||
                '',
              time: new Date(payload.createdAt || Date.now()).toLocaleString(),
              read: !!payload.read,
              type: payload.type || 'info',
            };
            setNotifications(prev => [n, ...prev]);

            // Si es notificación de examen calificado, mostrar toast con link a resultados
            const resultId = payload.data?.resultId || payload.resultId;
            if (payload.type === 'exam.graded' && resultId) {
              toast.success('¡Tu examen ha sido calificado!', {
                duration: 8000,
                action: {
                  label: 'Ver resultados',
                  onClick: () => navigate(`/student/results/${resultId}`),
                },
              });
            } else {
              toast.success('Nueva notificación', { duration: 2000 });
            }
          };

          notifHandlerRef.current = handler;
          notificationSocket.on('notification.created', handler);
          await notificationSocket.connect();
        } catch (err) {
          console.error('Error initializing notification socket', err);
        }
      })();
    }

    return () => {
      if (notifHandlerRef.current) {
        notificationSocket.off('notification.created', notifHandlerRef.current);
        notifHandlerRef.current = null;
      }
    };
  }, [isAuthenticated, user?.role, user?.firstName]);

  // Escuchar eventos personalizados de cambio de auth
  useEffect(() => {
    const handleAuthChange = () => {
      // console.log('🔄 [Header] Evento auth-state-changed recibido');
      setUserForceUpdate(prev => prev + 1);
    };

    window.addEventListener('auth-state-changed', handleAuthChange);
    return () =>
      window.removeEventListener('auth-state-changed', handleAuthChange);
  }, []);

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Detectar Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const userRole = user?.role;
  const profilePath =
    userRole === 'student' ? '/student/profile' :
    userRole === 'teacher' ? '/teacher/profile' : null;
  const filteredRoutes = protectedRoutes.filter(
    route =>
      route.role?.includes('all') ||
      (route.role?.includes(userRole) && route.hidden !== true)
  );

  // Debug para ver el estado en Header
  // console.log('📊 [Header] Estado completo:', {
  //     hasUser: !!user,
  //     userRole,
  //     firstName: user?.firstName,
  //     lastName: user?.lastName,
  //     email: user?.email,
  //     fullUser: user,
  //     isAuthenticated,
  //     routesLength: filteredRoutes.length,
  //     allRoutes: protectedRoutes.length
  // });

  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  const openCommandPalette = () => {
    setIsCommandPaletteOpen(true);
  };

  const closeCommandPalette = () => {
    setIsCommandPaletteOpen(false);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    // Call API
    (async () => {
      try {
        await notificationService.markInAppNotificationAsRead(id);
      } catch (err) {
        console.error('Error marking notification read', err);
      }
    })();
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    // Call API
    (async () => {
      try {
        notifications.forEach(async (element) => { 
          await notificationService.markInAppNotificationAsRead(element.id);
        });
      } catch (err) {
        console.error('Error marking all notifications read', err);
      }
    })();
  };

  const deleteNotification = (id: string) => {
    // Optimistic UI update
    setNotifications(prev => prev.filter(n => n.id !== id));

    (async () => {
      try {
        const res = await notificationService.deleteInAppNotification(id);
        if (!res || !res.success) {
          console.warn(
            'Failed to delete notification on server, refreshing list'
          );
          // Refresh list
          const refreshed = await notificationService.getInAppNotifications({
            recipientId: user.id,
            limit: 20,
          });
          if (refreshed?.success && Array.isArray(refreshed.data)) {
            const normalized = refreshed.data.map((n: any) => ({
              id: n._id,
              title: n.content?.title || 'Notificación',
              message: n.content?.body || n.content?.message || '',
              time: new Date(n.createdAt).toLocaleString(),
              read: !!n.read,
              type: (n.type as any) || 'info',
            }));
            setNotifications(normalized);
          }
        }
      } catch (err) {
        console.error('Error deleting notification', err);
      }
    })();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'exam':
        return <BookOpen className="h-4 w-4 text-purple-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <>
      {/* Header Principal */}
      <header className="fixed top-0 z-50 w-full">
        <div className="flex justify-end lg:grid lg:grid-cols-[1fr_auto_1fr] items-center w-full mx-auto mt-2 px-4">
          {/* Logo/Brand - Solo visible en desktop */}
          <div className="hidden lg:flex items-center min-w-0">
            <img
              src="/CBA_Horizontal_blanco.webp"
              alt="CBA Platform"
              className="h-8 w-auto max-w-[160px] object-contain invert dark:invert-0"
            />
          </div>

          {/* Desktop Navigation — íconos en lg/xl, íconos+texto en 2xl */}
          <nav className="hidden lg:flex px-3 py-1 rounded-full bg-card/95 shadow-sm backdrop-blur-xl border border-border text-foreground justify-center items-center gap-0.5">
            {filteredRoutes.map(route => {
              const IconComponent = route.icon;
              const isActive = location.pathname === route.path;

              return (
                <button
                  key={route.path}
                  onClick={() => handleNavigation(route.path)}
                  title={route.name}
                  className={`
                    flex items-center gap-1.5 border border-transparent px-2 py-1.5 rounded-md transition-all duration-200 hover:cursor-pointer
                    ${isActive
                      ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                      : 'text-foreground/70 hover:text-blue-400 hover:bg-blue-500/5 hover:border-blue-500/20'
                    }
                  `}
                  aria-label={route.name}
                >
                  {IconComponent && <IconComponent className="h-4 w-4 shrink-0" />}
                  <span className="hidden 2xl:block text-xs font-medium truncate max-w-[96px]">
                    {route.name}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Actions: Search + Notifications + User Menu + Mobile Menu Button */}
          <div className="flex items-center gap-2 justify-end">
            {/* Command Palette Button - Desktop */}
            <div className="hidden lg:block">
              <button
                onClick={openCommandPalette}
                className="flex items-center px-2 py-1 text-sm text-muted-foreground bg-card border border-border/60 rounded-lg hover:bg-muted hover:text-foreground transition-all duration-300"
              >
                <Search className="h-4 w-4" />
                <kbd className="pointer-events-none hidden xl:inline-flex h-5 select-none items-center gap-1 rounded px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100">
                  Ctrl+K
                </kbd>
              </button>
            </div>
            <div className="hidden lg:block">
                <ThemeToggle></ThemeToggle>
            </div>

            {/* Notifications - Desktop */}
            <div className="hidden lg:block relative" ref={notificationRef}>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative border border-border bg-card backdrop-blur-sm hover:bg-muted transition-all duration-300"
              >
                <Bell className="h-4 w-4 text-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </Button>
              {/* Notifications Dropdown */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
                  {/* Gradiente metálico solo en dark mode */}
                  <div className="absolute inset-0 pointer-events-none hidden dark:block">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-full bg-gradient-to-l from-transparent via-slate-500/28 to-transparent blur-2xl" />
                  </div>
                  {/* Header */}
                  <div className="relative flex items-center justify-between p-4 border-b border-border/60">
                    <h3 className="text-sm font-semibold text-popover-foreground">
                      Notificaciones
                    </h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-blue-500 hover:text-blue-300 transition-colors"
                      >
                        Marcar todas como leídas
                      </button>
                    )}
                  </div>

                  {/* Notifications List */}
                  <div className="relative max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No tienes notificaciones</p>
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <div
                          key={notification.id}
                          className={`p-4 border-b hover:cursor-pointer border-border/50 hover:bg-muted/30 transition-colors group ${
                            !notification.read ? 'bg-blue-500/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <h4
                                  className={`text-sm font-medium ${
                                    !notification.read
                                      ? 'text-popover-foreground'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {notification.title}
                                </h4>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {!notification.read && (
                                    <button
                                      onClick={() =>
                                        markAsRead(notification.id)
                                      }
                                      className="p-1 hover:bg-muted rounded"
                                      title="Marcar como leída"
                                    >
                                      <Check className="h-3 w-3 text-green-500" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      deleteNotification(notification.id)
                                    }
                                    className="p-1 hover:bg-muted rounded"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="h-3 w-3 text-red-500" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <span className="text-xs text-muted-foreground/70 mt-1 block">
                                {notification.time}
                              </span>
                            </div>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0 mt-2"></div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div className="relative p-3 border-t border-border/60">
                    <button
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        setIsAllNotificationsOpen(true);
                      }}
                      className="w-full text-xs text-center text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Ver todas las notificaciones
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Menu Desktop */}
            <div className="hidden lg:block relative" ref={userMenuRef}>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="border border-border bg-card backdrop-blur-sm hover:bg-muted transition-all duration-300 overflow-hidden p-0 rounded-full w-10 h-10"
              >
                <UserAvatar
                  avatarUrl={user?.profile?.avatarUrl}
                  firstName={user?.firstName}
                  lastName={user?.lastName}
                  size="md"
                />
              </Button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-popover/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl overflow-hidden">
                  {/* User Info */}
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        avatarUrl={user?.profile?.avatarUrl}
                        firstName={user?.firstName}
                        lastName={user?.lastName}
                        size="sm"
                      />
                      <div>
                        <p className="text-sm font-medium text-popover-foreground">
                          {user?.firstName && user?.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user?.name || 'Usuario'}
                        </p>
                        {/* <p className="text-xs text-gray-400">
                                                    {user?.email || 'usuario@ejemplo.com'}
                                                </p> */}
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    {profilePath && (
                      <>
                        <button
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm text-popover-foreground hover:bg-muted/50 transition-colors"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            navigate(profilePath);
                          }}
                        >
                          <User className="h-4 w-4" />
                          Mi Perfil
                        </button>
                        <hr className="my-2 border-border" />
                      </>
                    )}
                    <button
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            {!isMobileMenuOpen && (
              <Button
                variant="outline"
                size="icon"
                onClick={toggleMobileMenu}
                className="lg:hidden border border-border bg-card backdrop-blur-sm hover:bg-muted transition-all duration-300"
              >
                <Menu className="h-4 w-4 text-foreground" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={toggleMobileMenu}
          />

          {/* Mobile Menu Panel */}
          <div className="fixed top-0 left-0 h-full w-64 bg-popover/95 backdrop-blur-sm border-r border-border shadow-xl transform transition-transform duration-300">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <img
                  src="/CBA_Horizontal_blanco.webp"
                  alt="CBA Platform"
                  className="h-7 w-auto invert dark:invert-0"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMobileMenu}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Search Button Mobile */}
              <div className="p-4 border-b border-border flex gap-2">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    openCommandPalette();
                  }}
                  className="flex items-center gap-3 flex-1 p-2 text-muted-foreground bg-muted/50 hover:bg-muted rounded-lg transition-all duration-200"
                >
                  <Search className="h-5 w-5" />
                  <span className="text-xs">Buscar rutas...</span>
                  <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    Ctrl+K
                  </kbd>
                </button>
                <Button
                  variant="outline"
                  size="icon"
                  className="border border-border bg-card backdrop-blur-sm hover:bg-muted transition-all duration-300 relative"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAllNotificationsOpen(true);
                  }}
                >
                  <Bell className="h-4 w-4 text-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 p-4">
                <div className="space-y-2">
                  {filteredRoutes.map(route => {
                    const IconComponent = route.icon;
                    const isActive = location.pathname === route.path;

                    return (
                      <button
                        key={route.path}
                        onClick={() => handleNavigation(route.path)}
                        className={`
                                                    flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all duration-200
                                                    ${
                                                      isActive
                                                        ? 'bg-blue-500/20 text-blue-400'
                                                        : 'text-foreground/70 hover:bg-muted hover:text-blue-400'
                                                    }
                                                `}
                      >
                        {IconComponent && <IconComponent className="h-5 w-5" />}
                        <span className="font-medium">{route.name}</span>
                      </button>
                    );
                  })}
                </div>
              </nav>

              {/* User Actions */}
              <div className="p-4 border-t border-border">
                <div className="space-y-2">
                  <button
                    className="flex items-center gap-3 w-full p-3 text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Todas las notificaciones */}
      <NotificationsSheet
        open={isAllNotificationsOpen}
        onOpenChange={setIsAllNotificationsOpen}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onDelete={deleteNotification}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
      />
    </>
  );
};

export default Header;
