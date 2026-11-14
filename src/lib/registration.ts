import type { RegistrationRequest } from '@/api/schemas';

import { formatIndianMobile } from './validation';

/**
 * WhatsApp message the CecureUs team receives when a person creates an account in the app.
 * Plain text, one field per line, so it is easy to check against the admin panel.
 */
export function registrationMessage(r: RegistrationRequest): string {
  const name = [r.firstName, r.lastName].filter(Boolean).join(' ');
  const lines = [
    'New CecureUs account',
    '',
    `Account type: ${r.userType === 'corporate' ? 'Corporate employee' : 'Individual'}`,
    `Name: ${name}`,
    `Mobile: ${formatIndianMobile(r.mobile)}`,
    `Email: ${r.email}`,
  ];
  if (r.userType === 'corporate') {
    if (r.companyName) lines.push(`Company: ${r.companyName}`);
    if (r.employeeId) lines.push(`Employee ID: ${r.employeeId}`);
  }
  lines.push('', 'I have just created this account in the CecureUs app with the mobile number above.');
  return lines.join('\n');
}

export function validateCompanyName(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Company name is required.';
  if (v.length > 100) return 'Company name is too long.';
  return null;
}
