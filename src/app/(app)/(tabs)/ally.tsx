import { router, type Href } from 'expo-router';
import Clock from 'lucide-react-native/icons/clock';
import Heart from 'lucide-react-native/icons/heart';
import Lock from 'lucide-react-native/icons/lock';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Phone from 'lucide-react-native/icons/phone';
import Send from 'lucide-react-native/icons/send';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AllyMascot } from '@/components/illustrations';
import { TopNav } from '@/components/top-nav';
import { AppText, Button, Screen, SectionHeader } from '@/components/ui';
import { HELPLINE_DISPLAY } from '@/config/constants';
import { confirmAndCallHelpline, openWhatsApp } from '@/lib/contact';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

/**
 * Ally (AI companion) is Phase 2. In Phase 1 the topic chips route to the most
 * relevant real resource; the chat box explains that Ally is coming and offers human support.
 */
const TOPICS: { emoji: string; label: string; sub: string; href?: Href; action?: () => void }[] = [
  { emoji: '💬', label: 'I need to talk', sub: "Talk about what's bothering you", href: '/talk-to-us' },
  { emoji: '😤', label: 'Feeling stressed', sub: 'Help me manage stress better', href: { pathname: '/breathing/[id]', params: { id: 'box' } } },
  { emoji: '😟', label: 'Anxiety support', sub: 'Ways to calm my anxiety', href: { pathname: '/breathing/[id]', params: { id: 'panic-reset' } } },
  { emoji: '🌙', label: 'Sleep better', sub: 'Tips for improved sleep', href: { pathname: '/breathing/[id]', params: { id: 'sleep-478' } } },
  { emoji: '💼', label: 'Work concerns', sub: 'Support for work related issues', href: { pathname: '/articles', params: { category: 'Workplace' } } },
  { emoji: '💝', label: 'Mood support', sub: "I'm feeling low or overwhelmed", href: '/counsellors' },
];

const QUICK = [
  { emoji: '🧘', label: '2-min Breathing', minutes: 2, href: { pathname: '/breathing/[id]', params: { id: 'calm-2min' } } },
  { emoji: '☀️', label: 'Calm Down Now', minutes: 1, href: { pathname: '/breathing/[id]', params: { id: 'panic-reset' } } },
  { emoji: '📝', label: 'Write It Out', minutes: 3, href: '/journal' },
  { emoji: '🌙', label: 'Relax & Unwind', minutes: 4, href: { pathname: '/breathing/[id]', params: { id: 'sleep-478' } } },
] as const satisfies readonly { emoji: string; label: string; minutes: number; href: Href }[];

function explainComingSoon() {
  Alert.alert(
    'Ally chat is coming soon',
    `Until then, our team is here for you 24/7. Call ${HELPLINE_DISPLAY} or message us on WhatsApp.`,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'WhatsApp', onPress: () => void openWhatsApp() },
      { text: 'Call', onPress: confirmAndCallHelpline },
    ],
  );
}

export default function AllyScreen() {
  return (
    <Screen testID="ally-screen" header={<TopNav />}>
      <View style={styles.hero}>
        <View style={styles.flex}>
          <AppText variant="display">Hi, I&apos;m Ally 👋</AppText>
          <AppText color={colors.textMuted}>Your mental wellness companion.</AppText>
          <View style={styles.heartRow}>
            <Heart size={14} color={colors.teal} />
            <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
              I&apos;m here to listen, understand and support you.
            </AppText>
          </View>
        </View>
        <AllyMascot size={92} />
      </View>

      <View style={styles.section}>
        <View>
          <AppText variant="subheading">How can I help you today?</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            Select a topic or ask me anything that&apos;s on your mind.
          </AppText>
        </View>
        <View style={styles.topics}>
          {TOPICS.map((t) => (
            <Pressable
              key={t.label}
              testID={`topic-${t.label}`}
              accessibilityRole="button"
              accessibilityLabel={`${t.label}. ${t.sub}`}
              onPress={() => (t.href ? router.push(t.href) : t.action?.())}
              style={[styles.topic, shadow.card]}
            >
              <AppText style={styles.topicEmoji} aria-hidden>
                {t.emoji}
              </AppText>
              <View style={styles.flex}>
                <AppText variant="label" style={styles.bold}>
                  {t.label}
                </AppText>
                <AppText variant="micro" color={colors.textMuted}>
                  {t.sub}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        testID="ask-ally"
        accessibilityRole="button"
        accessibilityLabel="Ask Ally anything. Ally chat is coming soon"
        onPress={explainComingSoon}
        style={[styles.ask, shadow.card]}
      >
        <AppText color={colors.textMuted} style={styles.flex}>
          Ask Ally anything...
        </AppText>
        <View style={styles.send}>
          <Send size={14} color="#FFFFFF" />
        </View>
      </Pressable>

      <View style={styles.notice} testID="ally-coming-soon">
        <Lock size={18} color={colors.teal} />
        <View style={styles.flex}>
          <AppText variant="label" color={colors.primary}>
            Ally chat is coming soon — real people are here 24/7.
          </AppText>
          <AppText variant="micro" color={colors.textMuted}>
            Talk to our team any time, confidentially and free.
          </AppText>
        </View>
      </View>

      <View style={styles.humanRow}>
        <Button
          compact
          variant="outline"
          label="WhatsApp us"
          icon={<MessageCircle size={14} color={colors.primary} />}
          onPress={() => void openWhatsApp()}
          style={styles.flex}
        />
        <Button
          compact
          label={`Call ${HELPLINE_DISPLAY}`}
          icon={<Phone size={14} color="#FFFFFF" />}
          onPress={confirmAndCallHelpline}
          style={styles.flex}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Quick Activities" onAction={() => router.push('/breathing')} />
        <View style={styles.quick}>
          {QUICK.map((q, i) => (
            <Pressable
              key={q.label}
              accessibilityRole="button"
              accessibilityLabel={`${q.label}, ${q.minutes} minutes`}
              onPress={() => router.push(q.href)}
              style={styles.quickItem}
            >
              <View style={[styles.quickIcon, { backgroundColor: i % 2 === 0 ? colors.tealLight : colors.amberLight }]}>
                <AppText style={styles.quickEmoji} aria-hidden>
                  {q.emoji}
                </AppText>
              </View>
              <AppText variant="micro" align="center">
                {q.label}
              </AppText>
              <View style={styles.time}>
                <Clock size={9} color={colors.textMuted} />
                <AppText variant="micro" color={colors.textMuted}>
                  {q.minutes} mins
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: fonts.bold },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heartRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  section: { gap: spacing.md },
  topics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  topic: {
    width: '48.5%',
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  topicEmoji: { fontSize: 16, lineHeight: 22 },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs + 2,
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.tealLight,
    marginTop: -spacing.sm,
  },
  humanRow: { flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.sm },
  quick: { flexDirection: 'row', gap: spacing.sm },
  quickItem: { flex: 1, alignItems: 'center', gap: 2 },
  quickIcon: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  quickEmoji: { fontSize: 26, lineHeight: 32 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
