// The reminder permission, kept current: read on focus and on return from the system settings
// app. Shared by Home's reminders card and the Settings row.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { requestSync } from '@/notifications';
import { getReminderPermission, requestReminderPermission, type ReminderPermission } from '@/notifications/permissions';

export function useReminderPermission(): {
  /** null until the first read comes back. */
  permission: ReminderPermission | null;
  /** Ask the OS, or open system settings once it won't ask again. Reschedules once granted. */
  turnOn: () => void;
} {
  const [permission, setPermission] = useState<ReminderPermission | null>(null);

  useFocusEffect(
    useCallback(() => {
      const read = () => getReminderPermission().then(setPermission);
      read();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && read());
      return () => sub.remove();
    }, []),
  );

  const turnOn = useCallback(() => {
    if (permission === 'denied') {
      void Linking.openSettings();
      return;
    }
    void requestReminderPermission().then((p) => {
      setPermission(p);
      if (p === 'granted') void requestSync({ force: true });
    });
  }, [permission]);

  return { permission, turnOn };
}
