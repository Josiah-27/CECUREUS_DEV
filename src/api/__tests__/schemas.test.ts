import { availabilitySchema, bookingSchema, counsellorSchema, userSchema } from '../schemas';

describe('counsellorSchema', () => {
  it('normalises legacy comma-separated columns and numeric strings', () => {
    const c = counsellorSchema.parse({
      id: 7,
      name: 'Counsellor',
      experienceYears: '28',
      languages: '',
      expertise: 'Anger Management, Anxiety Management , Anger Management,',
    });
    expect(c.id).toBe('7');
    expect(c.experienceYears).toBe(28);
    expect(c.languages).toEqual([]);
    expect(c.expertise).toEqual(['Anger Management', 'Anxiety Management']);
    expect(c.modes).toEqual(['audio', 'video', 'chat']);
  });

  it('strips sensitive fields even if the server over-shares them', () => {
    const c = counsellorSchema.parse({
      id: '1',
      name: 'Counsellor',
      doc_password: 'fde0f6844ac5b2f35b865e9e88da851c',
      doc_otp: '323736',
      bank_acc_number: '000123',
      doc_pannumber: 'ABCDE1234F',
      doc_email: 'x@y.z',
      doc_mobile: '9999999999',
    });
    const serialised = JSON.stringify(c);
    for (const secret of ['fde0f68', '323736', '000123', 'ABCDE1234F', 'x@y.z', '9999999999']) {
      expect(serialised).not.toContain(secret);
    }
  });

  it('treats blank optional text as null', () => {
    expect(counsellorSchema.parse({ id: 1, name: 'A', about: '   ' }).about).toBeNull();
  });

  it('rejects records without a name', () => {
    expect(counsellorSchema.safeParse({ id: 1, name: '' }).success).toBe(false);
  });
});

describe('userSchema', () => {
  it('requires a valid email and known user type', () => {
    const base = { id: 1, firstName: 'A', email: 'a@b.co', userType: 'corporate' };
    expect(userSchema.safeParse(base).success).toBe(true);
    expect(userSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
    expect(userSchema.safeParse({ ...base, userType: 'guest' }).success).toBe(false);
  });
});

describe('availabilitySchema', () => {
  it('rejects malformed dates and timestamps', () => {
    expect(
      availabilitySchema.safeParse({ timezone: 'Asia/Kolkata', days: [{ date: '02-11-2026', slots: [] }] })
        .success,
    ).toBe(false);
    expect(
      availabilitySchema.safeParse({
        timezone: 'Asia/Kolkata',
        days: [{ date: '2026-11-02', slots: [{ start: 'soon', end: 'later' }] }],
      }).success,
    ).toBe(false);
  });
});

describe('bookingSchema', () => {
  it('rejects unknown statuses so the UI never shows an unconfirmed booking as confirmed', () => {
    const base = {
      id: 1,
      counsellorId: 2,
      counsellorName: 'C',
      start: '2026-11-02T04:30:00.000Z',
      end: '2026-11-02T05:30:00.000Z',
      mode: 'video',
      status: 'confirmed',
    };
    expect(bookingSchema.parse(base).cancellable).toBe(false);
    expect(bookingSchema.safeParse({ ...base, status: 'booked?' }).success).toBe(false);
  });
});
