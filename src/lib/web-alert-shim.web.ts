import { Alert, type AlertButton } from 'react-native';

/**
 * WEB PREVIEW ONLY. react-native-web's Alert.alert is a no-op, so confirmation dialogs
 * (log out, call helpline, delete entry…) would silently do nothing in the browser.
 * Map them to window.confirm / window.alert: OK runs the first non-cancel button.
 */
export function installWebAlertShim() {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = message ? `${title}\n\n${message}` : title;
    const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
    if (actions.length === 0) {
      globalThis.alert?.(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    if (globalThis.confirm?.(text)) actions[0].onPress?.();
    else buttons?.find((b) => b.style === 'cancel')?.onPress?.();
  };
}
