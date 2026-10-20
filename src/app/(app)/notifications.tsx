import BellOff from 'lucide-react-native/icons/bell-off';
import { router } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';

/**
 * Notification centre. Push notifications (session reminders, new resources) need a
 * backend + FCM setup that is not part of Phase 1, so this shows an honest empty state.
 */
export default function NotificationsScreen() {
  return (
    <Screen edges={['bottom']}>
      <EmptyState
        Icon={BellOff}
        title="You're all caught up"
        message="Session reminders and updates will appear here. Your upcoming sessions are always in My Sessions."
        action={{ label: 'Go to My Sessions', onPress: () => router.push('/sessions') }}
      />
    </Screen>
  );
}
