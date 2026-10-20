import { Alert, Linking } from 'react-native';

import { confirmAndCallHelpline, openDialer, openWhatsApp, telUrl, whatsappUrl } from '../contact';

describe('URL construction', () => {
  it('builds the helpline tel: URL', () => {
    expect(telUrl()).toBe('tel:18001219497');
    expect(telUrl('1800 121 9497')).toBe('tel:18001219497');
  });

  it('builds the WhatsApp wa.me URL for +91 7200500221 with an encoded message', () => {
    expect(whatsappUrl()).toBe('https://wa.me/917200500221');
    expect(whatsappUrl('+91 72005 00221', 'Hi & hello')).toBe('https://wa.me/917200500221?text=Hi%20%26%20hello');
  });

  it('rejects invalid numbers', () => {
    expect(() => telUrl('abc')).toThrow();
    expect(() => whatsappUrl('12')).toThrow();
  });
});

describe('actions', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('asks for confirmation and does not dial until the user confirms', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    confirmAndCallHelpline();
    expect(open).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Call']);
    buttons[1].onPress!();
    expect(open).toHaveBeenCalledWith('tel:18001219497');
  });

  it('cancelling the confirmation never opens the dialer', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    confirmAndCallHelpline();
    alert.mock.calls[0][2]![0].onPress?.();
    expect(open).not.toHaveBeenCalled();
  });

  it('falls back to showing the number when the dialer cannot open', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no telephony'));
    await expect(openDialer()).resolves.toBe(false);
    expect(alert.mock.calls[0][1]).toContain('1800 121 9497');
  });

  it('opens WhatsApp and falls back with the number on failure', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true);
    await expect(openWhatsApp('Hello')).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith('https://wa.me/917200500221?text=Hello');

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    open.mockRejectedValueOnce(new Error('nope'));
    await expect(openWhatsApp()).resolves.toBe(false);
    expect(alert.mock.calls[0][1]).toContain('+91 72005 00221');
  });
});
