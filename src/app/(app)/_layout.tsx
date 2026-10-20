import { Stack } from 'expo-router';

import { colors, typography } from '@/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { ...typography.heading, color: colors.text },
        contentStyle: { backgroundColor: colors.screen },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="counsellor/[id]" options={{ title: 'Counsellor Profile' }} />
      <Stack.Screen name="book/[id]" options={{ title: 'Book a Session' }} />
      <Stack.Screen name="booking-confirmed" options={{ title: 'Booking', headerBackVisible: false, gestureEnabled: false }} />
      <Stack.Screen name="sessions" options={{ title: 'My Sessions' }} />
      <Stack.Screen name="articles/index" options={{ title: 'Blogs & Articles' }} />
      <Stack.Screen name="articles/[id]" options={{ title: '' }} />
      <Stack.Screen name="videos" options={{ title: 'Videos' }} />
      <Stack.Screen name="assessments/index" options={{ title: 'Self Assessments' }} />
      <Stack.Screen name="assessments/[id]" options={{ title: 'Assessment' }} />
      <Stack.Screen name="breathing/index" options={{ title: 'Breathing Exercises' }} />
      <Stack.Screen name="breathing/[id]" options={{ title: '' }} />
      <Stack.Screen name="journal" options={{ title: "Today's Journal" }} />
      <Stack.Screen name="goals" options={{ title: 'My Goals' }} />
      <Stack.Screen name="progress" options={{ title: 'My Progress' }} />
      <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy & Safety' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete Account' }} />
      <Stack.Screen name="talk-to-us" options={{ title: 'Emergency Support' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Stack>
  );
}
