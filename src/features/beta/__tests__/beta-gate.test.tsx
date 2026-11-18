import { fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Text } from 'react-native';

import { BETA_CODE, BetaCodeScreen, isBetaCode, useBetaGate } from '../beta-gate';

function Harness() {
  const { state, unlock } = useBetaGate();
  if (state === 'checking') return null;
  return state === 'open' ? <Text>App opened</Text> : <BetaCodeScreen onSubmit={unlock} />;
}

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const original = process.env.EXPO_PUBLIC_BETA_GATE;

describe('beta gate (c_beta build)', () => {
  beforeEach(() => store.clear());
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_BETA_GATE;
    else process.env.EXPO_PUBLIC_BETA_GATE = original;
  });

  it('accepts only the beta code, ignoring case and surrounding spaces', () => {
    expect(BETA_CODE).toBe('AJDS');
    expect(isBetaCode('AJDS')).toBe(true);
    expect(isBetaCode('  ajds ')).toBe(true);
    expect(isBetaCode('AJD')).toBe(false);
    expect(isBetaCode('AJDSX')).toBe(false);
    expect(isBetaCode('')).toBe(false);
  });

  it('is off unless EXPO_PUBLIC_BETA_GATE=true (normal and production builds)', async () => {
    delete process.env.EXPO_PUBLIC_BETA_GATE;
    await render(<Harness />);
    expect(await screen.findByText('App opened')).toBeOnTheScreen();
    expect(screen.queryByTestId('beta-gate')).toBeNull();
  });

  it('keeps the app closed until the right code is entered, then remembers it on the device', async () => {
    process.env.EXPO_PUBLIC_BETA_GATE = 'true';
    const first = await render(<Harness />);

    await fireEvent.changeText(await screen.findByTestId('beta-code'), 'WXYZ');
    await fireEvent.press(screen.getByTestId('beta-submit'));
    expect(await screen.findByText(/not correct/)).toBeOnTheScreen();
    expect(screen.queryByText('App opened')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('beta-code'), 'ajds');
    await fireEvent.press(screen.getByTestId('beta-submit'));
    expect(await screen.findByText('App opened')).toBeOnTheScreen();
    await first.unmount();

    // Next launch on the same device: no code needed.
    await render(<Harness />);
    expect(await screen.findByText('App opened')).toBeOnTheScreen();
    expect(screen.queryByTestId('beta-gate')).toBeNull();
  });
});
