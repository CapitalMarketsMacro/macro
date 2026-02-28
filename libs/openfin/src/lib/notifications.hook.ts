import { useRef } from 'react';
import { NotificationsService } from './notifications.service';

/**
 * React hook for OpenFin notifications.
 *
 * Returns a stable `NotificationsService` instance that can be used to
 * create notifications from within React views. Registration happens in
 * the workspace shell — app views only call `create()`.
 */
export function useNotifications(): NotificationsService {
  const serviceRef = useRef<NotificationsService>(new NotificationsService());
  return serviceRef.current;
}
