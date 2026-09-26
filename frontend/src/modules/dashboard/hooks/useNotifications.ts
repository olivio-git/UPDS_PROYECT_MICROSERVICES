import { useAuthStore } from '@/modules/auth/services/authStore';
import { notificationService } from '@/services/notifications/notificationService';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'exam';
}

/** The API and the socket deliver the same notification in slightly different shapes. */
type RawNotification = {
  _id?: string; id?: string; title?: string; message?: string;
  /** Event name or display type, e.g. 'exam.graded' or 'info'. */
  type?: string;
  read?: boolean; createdAt?: string;
  content?: { title?: string; body?: string; message?: string };
  data?: { resultId?: string };
  resultId?: string;
};

const DISPLAY_TYPES: ReadonlyArray<AppNotification['type']> = ['info', 'success', 'warning', 'exam'];

function normalize(raw: RawNotification): AppNotification {
  const content = raw.content ?? {};
  return {
    id: raw._id ?? raw.id ?? '',
    title: content.title ?? raw.title ?? 'Notificación',
    message: content.body ?? content.message ?? raw.message ?? '',
    time: new Date(raw.createdAt ?? Date.now()).toLocaleString(),
    read: !!raw.read,
    type: DISPLAY_TYPES.includes(raw.type as AppNotification['type']) ? (raw.type as AppNotification['type']) : 'info',
  };
}

/**
 * In-app notifications for the signed-in user: initial load plus live updates
 * over the notifications socket.
 */
export function useNotifications() {
  const { user, isAuthenticated } = useAuthStore();
  const userId = user?.id;
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    let active = true;
    // recipientId is derived server-side from the JWT now (see
    // notification.controller.ts listNotifications) — no need to pass it.
    notificationService
      .getInAppNotifications({ onlyUnread: false, limit: 20 })
      .then((res) => {
        if (active && res?.success && Array.isArray(res.data)) setNotifications(res.data.map(normalize));
      })
      .catch((err) => console.error('Error loading notifications', err));

    const onCreated = (payload: RawNotification) => {
      setNotifications((prev) => [normalize(payload), ...prev]);
      const resultId = payload.data?.resultId ?? payload.resultId;
      if (payload.type === 'exam.graded' && resultId) {
        toast.success('¡Tu examen ha sido calificado!', {
          duration: 8000,
          action: { label: 'Ver resultados', onClick: () => navigate(`/student/results/${resultId}`) },
        });
      } else {
        toast.success('Nueva notificación', { duration: 2000 });
      }
    };

    notificationSocket.on('notification.created', onCreated);
    notificationSocket.connect().catch((err) => console.error('Error initializing notification socket', err));

    return () => {
      active = false;
      notificationSocket.off('notification.created', onCreated);
    };
  }, [isAuthenticated, userId, navigate]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    notificationService.markInAppNotificationAsRead(id).catch(() => undefined);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      prev.filter((n) => !n.read).forEach((n) => {
        notificationService.markInAppNotificationAsRead(n.id).catch(() => undefined);
      });
      return prev.map((n) => ({ ...n, read: true }));
    });
  }, []);

  const remove = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    notificationService.deleteInAppNotification(id).catch(() => undefined);
  }, []);

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAsRead,
    markAllAsRead,
    remove,
  };
}
