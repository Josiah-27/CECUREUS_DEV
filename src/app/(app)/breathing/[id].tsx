import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';
import SkipForward from 'lucide-react-native/icons/skip-forward';
import Sparkles from 'lucide-react-native/icons/sparkles';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { MoodSelector } from '@/components/mood-selector';
import { AppText, Button, EmptyState, Screen } from '@/components/ui';
import { activityStore, moodStore, type Mood } from '@/local/stores';
import { findExercise, formatClock, phaseAt } from '@/lib/breathing';
import { goBackOr } from '@/lib/navigation';
import { colors, spacing } from '@/theme';

const CIRCLE = 220;

export default function BreathingExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = findExercise(String(id));
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [done, setDone] = useState(false);
  const [mood, setMood] = useState<Mood | null>(null);
  const [scale] = useState(() => new Animated.Value(0.55));
  const lastTick = useRef<number | null>(null);
  const lastPhase = useRef<string>('');

  const totalMs = (exercise?.totalSeconds ?? 0) * 1000;

  useEffect(() => {
    if (!running || !exercise) return;
    lastTick.current = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const delta = now - (lastTick.current ?? now);
      lastTick.current = now;
      setElapsedMs((prev) => {
        const next = Math.min(totalMs, prev + delta);
        if (next >= totalMs) {
          setRunning(false);
          setDone(true);
        }
        return next;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [running, exercise, totalMs]);

  const current = exercise ? phaseAt(exercise.phases, elapsedMs) : null;

  // Animate the circle and announce each new phase for screen-reader users.
  useEffect(() => {
    if (!running || !current || !exercise) return;
    const cycleMs = exercise.phases.reduce((sum, p) => sum + p.seconds * 1000, 0);
    const phaseKey = `${Math.floor(elapsedMs / cycleMs)}:${current.index}`;
    if (lastPhase.current === phaseKey) return;
    lastPhase.current = phaseKey;
    Animated.timing(scale, {
      toValue: current.phase.scale,
      duration: current.remaining * 1000,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
    AccessibilityInfo.announceForAccessibility(current.phase.label);
  }, [running, current, elapsedMs, scale, exercise]);

  if (!exercise || !current) {
    return <EmptyState title="Exercise not found" action={{ label: 'All exercises', onPress: () => router.replace('/breathing') }} />;
  }

  function finish() {
    void activityStore.log(exercise!.id, mood);
    if (mood) void moodStore.record(mood);
    goBackOr('/breathing');
  }

  if (done) {
    return (
      <Screen edges={['bottom']} footer={<Button testID="save-progress" label="Save progress" onPress={finish} />}>
        <View style={styles.center}>
          <Sparkles size={56} color={colors.amber} />
          <AppText variant="title" align="center">
            Well done!
          </AppText>
          <AppText align="center" color={colors.textMuted}>
            You completed {exercise.title}. How do you feel now?
          </AppText>
        </View>
        <MoodSelector value={mood} onChange={setMood} />
      </Screen>
    );
  }

  const remainingTotal = (totalMs - elapsedMs) / 1000;

  return (
    <Screen edges={['bottom']} contentStyle={styles.content}>
      <View style={styles.center}>
        <AppText variant="title" align="center">
          {exercise.title}
        </AppText>
        <AppText align="center" color={colors.textMuted}>
          {exercise.description}
        </AppText>
      </View>

      <View style={styles.circleWrap} accessible accessibilityLabel={`${current.phase.label}, ${current.remaining} seconds`}>
        <Animated.View style={[styles.circle, { transform: [{ scale }] }]} />
        <View style={styles.circleText} pointerEvents="none">
          <AppText variant="title" color={colors.primary}>
            {running || elapsedMs > 0 ? current.phase.label : 'Ready'}
          </AppText>
          {running || elapsedMs > 0 ? (
            <AppText variant="heading" color={colors.primary}>
              {current.remaining} sec
            </AppText>
          ) : null}
        </View>
      </View>

      {exercise.steps ? (
        <View style={styles.steps}>
          {exercise.steps.map((s, i) => (
            <AppText key={s}>
              {i + 1}. {s}
            </AppText>
          ))}
        </View>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          testID="toggle-breathing"
          accessibilityRole="button"
          accessibilityLabel={running ? 'Pause' : elapsedMs > 0 ? 'Resume' : 'Start'}
          onPress={() => setRunning((r) => !r)}
          style={styles.playButton}
        >
          {running ? <Pause size={26} color="#FFFFFF" fill="#FFFFFF" /> : <Play size={26} color="#FFFFFF" fill="#FFFFFF" />}
        </Pressable>
        <AppText variant="heading" testID="breathing-clock">
          {formatClock(remainingTotal)}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Finish now"
          onPress={() => {
            setRunning(false);
            setDone(true);
          }}
          style={styles.skip}
        >
          <SkipForward size={22} color={colors.textMuted} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'stretch' },
  center: { alignItems: 'center', gap: spacing.sm },
  circleWrap: { height: CIRCLE + 20, alignItems: 'center', justifyContent: 'center' },
  circle: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.primarySoft,
    borderWidth: 6,
    borderColor: '#9FD6D8',
  },
  circleText: { alignItems: 'center' },
  steps: { gap: spacing.xs },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
