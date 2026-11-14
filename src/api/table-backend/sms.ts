/**
 * OTP SMS via SMS Integra (or any HTTP GET SMS gateway).
 *
 * EXAMPLE INTEGRATION — the gateway URL is configured, not hard-coded. Paste the URL from the
 * SMS Integra dashboard into EXPO_PUBLIC_SMS_URL_TEMPLATE with these placeholders:
 *   {mobile}    10-digit number, e.g. 9876543210
 *   {mobile91}  with country code, e.g. 919876543210
 *   {message}   the URL-encoded SMS text
 *   {otp}       the bare code (for gateways that take the OTP as its own parameter)
 *   {date}      the current IST date and time, URL-encoded (SMS Integra's dtTimeNow)
 * SMS Integra:
 *   https://www.smsintegra.com/api/smsapi.aspx?uid=UID&pwd=PWD&mobile={mobile91}&msg={message}&sid=SID&type=0&dtTimeNow={date}&entityid=ENTITYID&tempid=TEMPID
 * The gateway answers HTTP 200 even when it rejects a message ("91 - Invalid Template ID ..."),
 * so the reply text is checked as well as the status.
 *
 * The text must match the DLT-approved template exactly (EXPO_PUBLIC_SMS_MESSAGE, {otp} placeholder).
 *
 * SECURITY: anything in EXPO_PUBLIC_* is compiled into the app. Moving this call to the CecureUs
 * server (docs/TABLE_BACKEND.md) keeps the gateway key off devices.
 */

export const DEFAULT_SMS_MESSAGE =
  'Your CecureUs verification code is {otp}. It is valid for 10 minutes. Do not share this code with anyone.';

export type SmsConfig = {
  /** Gateway URL with placeholders; null = not configured yet. */
  urlTemplate: string | null;
  messageTemplate: string;
  /** Development builds without a gateway print the code to the Metro console instead. */
  allowConsoleFallback: boolean;
};

export class SmsError extends Error {
  readonly code: 'SMS_NOT_CONFIGURED' | 'SMS_FAILED';
  constructor(code: SmsError['code'], message: string) {
    super(message);
    this.name = 'SmsError';
    this.code = code;
  }
}

/** Words a gateway uses when it answers 200 but did not accept the message. */
const REJECTED = /invalid|error|fail|denied|insufficient|expired|blocked|unauthori[sz]ed|not\s+(valid|allowed|found|enough)|please provide/i;

export function gatewayRejected(reply: string): boolean {
  return REJECTED.test(reply);
}

/** IST "YYYY-MM-DD HH:mm:ss". */
function istDateTime(ms: number): string {
  return new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

export function buildSmsUrl(
  template: string,
  mobileE164: string,
  otp: string,
  messageTemplate: string,
  nowMs: number = Date.now(),
): string {
  const ten = mobileE164.replace(/^\+91/, '');
  const message = messageTemplate.split('{otp}').join(otp);
  return template
    .split('{date}').join(encodeURIComponent(istDateTime(nowMs)))
    .split('{mobile91}').join(`91${ten}`)
    .split('{mobile}').join(ten)
    .split('{message}').join(encodeURIComponent(message))
    .split('{otp}').join(otp);
}

export async function sendOtpSms(
  config: SmsConfig,
  mobileE164: string,
  otp: string,
  fetchImpl: typeof fetch = (i, init) => globalThis.fetch(i, init),
): Promise<void> {
  if (!config.urlTemplate) {
    if (config.allowConsoleFallback) {
      console.warn(`[CecureUs dev] SMS gateway not configured. OTP for ${mobileE164}: ${otp}`);
      return;
    }
    throw new SmsError('SMS_NOT_CONFIGURED', 'SMS gateway is not configured');
  }
  // A browser may send the request but not read the gateway's reply (the gateway sends no CORS
  // headers), so the web build sends without reading it. Phones read and check the reply.
  const inBrowser = typeof document !== 'undefined';
  let res: Response;
  try {
    res = await fetchImpl(
      buildSmsUrl(config.urlTemplate, mobileE164, otp, config.messageTemplate),
      inBrowser ? { method: 'GET', mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer' } : { method: 'GET' },
    );
  } catch {
    throw new SmsError('SMS_FAILED', 'SMS gateway unreachable');
  }
  if (res.type === 'opaque') return;
  if (!res.ok) throw new SmsError('SMS_FAILED', `SMS gateway returned ${res.status}`);
  const reply = (await res.text().catch(() => '')).trim().slice(0, 200);
  if (gatewayRejected(reply)) {
    // The reply never contains the credentials or the code, so it is safe to show while developing.
    if (config.allowConsoleFallback) console.warn(`[CecureUs dev] SMS gateway refused the message: ${reply}`);
    throw new SmsError('SMS_FAILED', 'SMS gateway refused the message');
  }
}
