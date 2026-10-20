export type BreathPhase = { label: 'Inhale' | 'Hold' | 'Exhale' | 'Inhale again'; seconds: number; scale: number };

export type BreathingExercise = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: 'leaf-outline' | 'square-outline' | 'moon-outline' | 'pulse-outline' | 'footsteps-outline';
  totalSeconds: number;
  phases: BreathPhase[];
  /** Optional guided steps shown instead of / alongside the breathing circle. */
  steps?: string[];
};

export const BREATHING_EXERCISES: BreathingExercise[] = [
  {
    id: 'calm-2min',
    title: '2-min Calm Breathing',
    subtitle: 'Quick relaxation',
    description: 'Slow, even breaths to settle your nervous system.',
    icon: 'leaf-outline',
    totalSeconds: 120,
    phases: [
      { label: 'Inhale', seconds: 4, scale: 1 },
      { label: 'Exhale', seconds: 6, scale: 0.55 },
    ],
  },
  {
    id: 'box',
    title: 'Box Breathing',
    subtitle: 'Calm your mind',
    description: 'Inhale, hold, exhale and hold for four counts each.',
    icon: 'square-outline',
    totalSeconds: 180,
    phases: [
      { label: 'Inhale', seconds: 4, scale: 1 },
      { label: 'Hold', seconds: 4, scale: 1 },
      { label: 'Exhale', seconds: 4, scale: 0.55 },
      { label: 'Hold', seconds: 4, scale: 0.55 },
    ],
  },
  {
    id: 'sleep-478',
    title: 'Sleep Relaxation',
    subtitle: 'Better sleep',
    description: 'The 4-7-8 pattern helps your body wind down before sleep.',
    icon: 'moon-outline',
    totalSeconds: 240,
    phases: [
      { label: 'Inhale', seconds: 4, scale: 1 },
      { label: 'Hold', seconds: 7, scale: 1 },
      { label: 'Exhale', seconds: 8, scale: 0.55 },
    ],
  },
  {
    id: 'panic-reset',
    title: 'Panic Reset',
    subtitle: 'Instant calm',
    description: 'A double inhale followed by a long exhale (physiological sigh).',
    icon: 'pulse-outline',
    totalSeconds: 60,
    phases: [
      { label: 'Inhale', seconds: 2, scale: 0.85 },
      { label: 'Inhale again', seconds: 1, scale: 1 },
      { label: 'Exhale', seconds: 6, scale: 0.55 },
    ],
  },
  {
    id: 'grounding',
    title: 'Grounding Exercise',
    subtitle: 'Stay present',
    description: 'The 5-4-3-2-1 technique brings attention back to the present moment.',
    icon: 'footsteps-outline',
    totalSeconds: 180,
    phases: [
      { label: 'Inhale', seconds: 4, scale: 1 },
      { label: 'Exhale', seconds: 4, scale: 0.55 },
    ],
    steps: [
      'Name 5 things you can see.',
      'Name 4 things you can touch.',
      'Name 3 things you can hear.',
      'Name 2 things you can smell.',
      'Name 1 thing you can taste.',
    ],
  },
];

export function findExercise(id: string): BreathingExercise | undefined {
  return BREATHING_EXERCISES.find((e) => e.id === id);
}

/** Returns the active phase and seconds remaining in it for a given elapsed time. */
export function phaseAt(phases: BreathPhase[], elapsedMs: number): { index: number; phase: BreathPhase; remaining: number } {
  const cycleMs = phases.reduce((sum, p) => sum + p.seconds * 1000, 0);
  let t = ((elapsedMs % cycleMs) + cycleMs) % cycleMs;
  for (let index = 0; index < phases.length; index++) {
    const ms = phases[index].seconds * 1000;
    if (t < ms) return { index, phase: phases[index], remaining: Math.ceil((ms - t) / 1000) };
    t -= ms;
  }
  return { index: 0, phase: phases[0], remaining: phases[0].seconds };
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
