import { fireEvent, render, screen } from '@testing-library/react-native';

import { Avatar, initialsOf } from '../avatar';

describe('Avatar', () => {
  it('falls back to initials when the photo fails to load', () => {
    render(<Avatar name="Test Counsellor Two" uri="https://media.example.com/missing.png" />);
    fireEvent(screen.getByLabelText('Photo of Test Counsellor Two'), 'error', { nativeEvent: { error: 'not found' } });
    expect(screen.getByText('TT')).toBeOnTheScreen();
  });

  it('derives initials without honorifics', () => {
    expect(initialsOf('Dr. Neha Sharma')).toBe('NS');
    expect(initialsOf('Mr. Kannan Parthasarathy')).toBe('KP');
    expect(initialsOf('')).toBe('?');
  });
});
