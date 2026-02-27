import {
  AlertTriangle,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  Info,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/atoms/sheet';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'exam';
}

type FilterType = 'all' | 'unread';

const TYPE_CONFIG: Record<
  Notification['type'],
  { icon: React.ElementType; color: string; bg: string }
> = {
  info: {
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  success: {
    icon: CheckCircle2,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
  },
  exam: {
    icon: BookOpen,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
};

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
}

const NotificationsSheet = ({
  open,
  onOpenChange,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
}: NotificationsSheetProps) => {
  const [filter, setFilter] = useState<FilterType>('all');

  const unreadCount = notifications.filter(n => !n.read).length;
  const filtered =
    filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-md p-0 bg-gray-900 border-l border-gray-700/60 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2.5">
              <SheetTitle className="text-gray-100 text-base font-semibold">
                Notificaciones
              </SheetTitle>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Marcar todas
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mt-3 pb-4 border-b border-gray-700/60">
            {(['all', 'unread'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  filter === f
                    ? 'bg-gray-700/80 text-gray-100'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                )}
              >
                {f === 'all' ? 'Todas' : 'No leídas'}
                {f === 'unread' && unreadCount > 0 && (
                  <span className="ml-1.5 text-blue-400">{unreadCount}</span>
                )}
              </button>
            ))}
          </div>
        </SheetHeader>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="h-12 w-12 rounded-full bg-gray-800 flex items-center justify-center">
                <Bell className="h-6 w-6 text-gray-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-300">
                  Sin notificaciones
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {filter === 'unread'
                    ? 'No tienes notificaciones sin leer'
                    : 'Tu bandeja está vacía'}
                </p>
              </div>
            </div>
          ) : (
            <ul>
              {filtered.map(notification => {
                const config =
                  TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.info;
                const IconComponent = config.icon;

                return (
                  <li
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-3.5 px-5 py-4 border-b border-gray-800/60 group hover:bg-gray-800/30 transition-colors',
                      !notification.read && 'bg-blue-500/5'
                    )}
                  >
                    {/* Icono tipo */}
                    <div
                      className={cn(
                        'h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5',
                        config.bg
                      )}
                    >
                      <IconComponent className={cn('h-4 w-4', config.color)} />
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            'text-sm font-medium leading-snug',
                            notification.read ? 'text-gray-300' : 'text-white'
                          )}
                        >
                          {notification.title}
                        </p>

                        {/* Acciones */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {!notification.read && (
                            <button
                              onClick={() => onMarkAsRead(notification.id)}
                              className="p-1 rounded hover:bg-gray-700 transition-colors"
                              title="Marcar como leída"
                            >
                              <Check className="h-3.5 w-3.5 text-green-400" />
                            </button>
                          )}
                          <button
                            onClick={() => onDelete(notification.id)}
                            className="p-1 rounded hover:bg-gray-700 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        {notification.message}
                      </p>
                      <span className="text-xs text-gray-500 mt-2 block">
                        {notification.time}
                      </span>
                    </div>

                    {/* Punto no leído */}
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationsSheet;
