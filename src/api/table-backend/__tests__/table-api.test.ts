import { buildSmsUrl, gatewayRejected, sendOtpSms, SmsError } from '../sms';
import { createTableApi, TableApiError, type TableName } from '../table-api';

function setup(data: unknown) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify({ status: true, data }), { status: 200 });
  }) as typeof fetch;
  return { api: createTableApi({ baseUrl: 'https://example.test/api/', fetchImpl }), calls };
}

describe('SMS Integra', () => {
  const TEMPLATE =
    'https://www.smsintegra.com/api/smsapi.aspx?uid=U&pwd=P&mobile={mobile91}&msg={message}&sid=S&type=0&dtTimeNow={date}&entityid=E&tempid=T';
  const config = { urlTemplate: TEMPLATE, messageTemplate: 'Code {otp}.', allowConsoleFallback: false };

  it('fills the SMS Integra URL', () => {
    const url = new URL(buildSmsUrl(TEMPLATE, '+919876543210', '123456', 'Code {otp}.', Date.UTC(2026, 10, 14, 3, 0, 5)));
    expect(url.searchParams.get('mobile')).toBe('919876543210');
    expect(url.searchParams.get('msg')).toBe('Code 123456.');
    expect(url.searchParams.get('dtTimeNow')).toBe('2026-11-14 08:30:05');
    expect(url.searchParams.get('tempid')).toBe('T');
  });

  it('treats a 200 reply that reports an error as a failed send', async () => {
    expect(gatewayRejected('91 - Invalid Template ID. Please provide valid Template ID')).toBe(true);
    expect(gatewayRejected('100')).toBe(false);
    const refuse = (async () => new Response('91 - Invalid Entity ID.', { status: 200 })) as typeof fetch;
    await expect(sendOtpSms(config, '+919876543210', '123456', refuse)).rejects.toBeInstanceOf(SmsError);
    const accept = (async () => new Response('100', { status: 200 })) as typeof fetch;
    await expect(sendOtpSms(config, '+919876543210', '123456', accept)).resolves.toBeUndefined();
  });
});

describe('table API client hardening', () => {
  it('drops sensitive columns as soon as a response is parsed', async () => {
    const { api } = setup([
      { emp_id: '683', emp_name: 'Asha', emp_mobile: '9876543210', status: 'Active', emp_password: 'secret', emp_otp: '1234' },
    ]);
    const [row] = await api.list('employee_list');
    expect(row).toEqual({ emp_id: '683', emp_name: 'Asha', emp_mobile: '9876543210', status: 'Active' });
  });

  it('keeps counsellor rows free of contact, bank and login columns', async () => {
    const { api } = setup([
      { doc_id: '7', doc_name: 'Dr A', status: 'active', doc_password: 'x', doc_mobile: '9', bank_acc_number: '1', doc_pannumber: 'P' },
    ]);
    expect(await api.list('doctor_list')).toEqual([{ doc_id: '7', doc_name: 'Dr A', status: 'active' }]);
  });

  it('refuses tables outside the allowed four without calling the network', async () => {
    const { api, calls } = setup([]);
    await expect(api.list('admin_users' as TableName)).rejects.toBeInstanceOf(TableApiError);
    await expect(api.create('employee_list/../admin' as TableName, {})).rejects.toBeInstanceOf(TableApiError);
    expect(calls).toHaveLength(0);
  });

  it('never puts a non-numeric id into a URL', async () => {
    const { api, calls } = setup([{ emp_id: '683' }]);
    expect(await api.get('employee_list', '683/../../doctor_list')).toBeNull();
    expect(await api.get('employee_list', '0')).toBeNull();
    await expect(api.update('employee_list', '1 OR 1=1', { status: 'Cancel' })).rejects.toBeInstanceOf(TableApiError);
    expect(calls).toHaveLength(0);
  });

  it('only returns the row that was asked for', async () => {
    const { api } = setup([{ emp_id: '999', emp_name: 'Someone else' }]);
    expect(await api.get('employee_list', '683')).toBeNull();
  });

  it('strips the primary key from updates', async () => {
    const { api, calls } = setup([]);
    await api.update('booking_appointment', '12', { book_id: '99', status: 'Cancel' });
    expect(calls).toEqual([{ url: 'https://example.test/api/booking_appointment/12', method: 'PUT', body: { status: 'Cancel' } }]);
  });
});
