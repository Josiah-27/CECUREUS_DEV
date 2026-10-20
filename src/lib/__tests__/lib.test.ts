import { BREATHING_EXERCISES, findExercise, formatClock, phaseAt } from '../breathing';
import { addDays, googleCalendarUrl, isPast, parseYmd, toYmd } from '../date';
import { htmlToParagraphs } from '../html';
import { currentStreak } from '../streak';
import { normalizeIndianMobile, sanitizeOtp, validateEmail, validateName, validateOtp } from '../validation';

describe('validation', () => {
  it('validates emails', () => {
    expect(validateEmail('')).toMatch(/Enter your email/);
    expect(validateEmail('harsha@')).toMatch(/valid/);
    expect(validateEmail(' harsha.verma@company.co.in ')).toBeNull();
  });

  it('validates and sanitises OTPs', () => {
    expect(validateOtp('12345')).not.toBeNull();
    expect(validateOtp('123456')).toBeNull();
    expect(validateOtp('12a456')).not.toBeNull();
    expect(sanitizeOtp(' 123 456 789')).toBe('123456');
  });

  it('normalises Indian mobile numbers', () => {
    expect(normalizeIndianMobile('98765 43210')).toEqual({ value: '+919876543210', error: null });
    expect(normalizeIndianMobile('+91-98765-43210').value).toBe('+919876543210');
    expect(normalizeIndianMobile('09876543210').value).toBe('+919876543210');
    expect(normalizeIndianMobile('').value).toBeNull();
    expect(normalizeIndianMobile('12345').error).not.toBeNull();
    expect(normalizeIndianMobile('5876543210').error).not.toBeNull();
  });

  it('validates names including non-Latin scripts', () => {
    expect(validateName('Harsha')).toBeNull();
    expect(validateName('ஹர்ஷா')).toBeNull();
    expect(validateName('')).toMatch(/required/);
    expect(validateName('<script>')).toMatch(/invalid/);
  });
});

describe('date', () => {
  it('formats and parses local calendar dates', () => {
    const d = parseYmd('2026-11-02');
    expect(d.getDate()).toBe(2);
    expect(toYmd(d)).toBe('2026-11-02');
    expect(toYmd(addDays(d, 30))).toBe('2026-12-02');
  });

  it('detects past instants', () => {
    expect(isPast('2026-01-01T00:00:00Z', Date.parse('2026-06-01T00:00:00Z'))).toBe(true);
    expect(isPast('2027-01-01T00:00:00Z', Date.parse('2026-06-01T00:00:00Z'))).toBe(false);
  });

  it('builds a Google Calendar template URL in UTC', () => {
    const url = googleCalendarUrl({
      title: 'CecureUs session',
      start: '2026-11-02T04:30:00.000Z',
      end: '2026-11-02T05:30:00.000Z',
    });
    expect(url).toContain('dates=20261102T043000Z/20261102T053000Z');
    expect(url).toContain('text=CecureUs%20session');
  });
});

describe('htmlToParagraphs', () => {
  it('strips tags, scripts and decodes entities', () => {
    const html =
      '<h2>Title</h2><p>First&nbsp;line<br>second &amp; third</p><script>alert(1)</script><ul><li>One</li><li>Two</li></ul><p>&#8220;Quote&#8221;</p>';
    expect(htmlToParagraphs(html)).toEqual(['Title', 'First line\nsecond & third', '• One\n• Two', '“Quote”']);
  });

  it('returns no paragraphs for empty markup', () => {
    expect(htmlToParagraphs('<p> </p><div></div>')).toEqual([]);
  });
});

describe('breathing', () => {
  const box = findExercise('box')!;

  it('has unique exercise ids with positive phases', () => {
    expect(new Set(BREATHING_EXERCISES.map((e) => e.id)).size).toBe(BREATHING_EXERCISES.length);
    BREATHING_EXERCISES.forEach((e) => e.phases.forEach((p) => expect(p.seconds).toBeGreaterThan(0)));
  });

  it('computes the active phase and remaining seconds', () => {
    expect(phaseAt(box.phases, 0)).toMatchObject({ index: 0, remaining: 4 });
    expect(phaseAt(box.phases, 3500)).toMatchObject({ index: 0, remaining: 1 });
    expect(phaseAt(box.phases, 4000).phase.label).toBe('Hold');
    expect(phaseAt(box.phases, 9000).phase.label).toBe('Exhale');
    expect(phaseAt(box.phases, 16000)).toMatchObject({ index: 0 }); // wraps to next cycle
  });

  it('formats a clock', () => {
    expect(formatClock(92)).toBe('01:32');
    expect(formatClock(-5)).toBe('00:00');
  });
});

describe('currentStreak', () => {
  const today = new Date(2026, 10, 10);
  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-11-10', '2026-11-09', '2026-11-08', '2026-11-06'], today)).toBe(3);
  });
  it('keeps a streak alive until today is over', () => {
    expect(currentStreak(['2026-11-09', '2026-11-08'], today)).toBe(2);
  });
  it('is zero when broken', () => {
    expect(currentStreak(['2026-11-07'], today)).toBe(0);
    expect(currentStreak([], today)).toBe(0);
  });
});
