import { Alert, Linking } from 'react-native';

import { HELPLINE_DISPLAY, HELPLINE_NUMBER, WHATSAPP_DISPLAY, WHATSAPP_NUMBER } from '@/config/constants';

/** tel: opens the dialer pre-filled (Android ACTION_DIAL) — it never places the call itself. */
export function telUrl(number: string = HELPLINE_NUMBER): string {
  const digits = number.replace(/[^\d+]/g, '');
  if (!/^\+?\d{6,15}$/.test(digits)) throw new Error('Invalid phone number');
  return `tel:${digits}`;
}

/**
 * wa.me universal link: opens WhatsApp when installed, otherwise the browser,
 * so no package-visibility <queries> entry is needed on Android 11+.
 */
export function whatsappUrl(number: string = WHATSAPP_NUMBER, message?: string): string {
  const digits = number.replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(digits)) throw new Error('Invalid WhatsApp number');
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

async function openOrExplain(url: string, fallbackTitle: string, fallbackBody: string) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert(fallbackTitle, fallbackBody);
    return false;
  }
}

export function openDialer(number: string = HELPLINE_NUMBER, display: string = HELPLINE_DISPLAY) {
  return openOrExplain(
    telUrl(number),
    'Unable to open the phone app',
    `Please call ${display} from any phone. Available 24/7, confidential and free.`,
  );
}

/** Shows a confirmation dialog first; only opens the dialer if the user confirms. */
export function confirmAndCallHelpline() {
  Alert.alert(`Call ${HELPLINE_DISPLAY}?`, 'You will be connected to the CecureUs support line. Available 24/7.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Call', onPress: () => void openDialer() },
  ]);
}

export function openWhatsApp(message = 'Hi CecureUs, I would like to talk to someone.') {
  return openOrExplain(
    whatsappUrl(WHATSAPP_NUMBER, message),
    'Unable to open WhatsApp',
    `Please message us on WhatsApp at ${WHATSAPP_DISPLAY}.`,
  );
}
