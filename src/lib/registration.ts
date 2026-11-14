import type { RegistrationRequest } from '@/api/schemas';

import { formatIndianMobile } from './validation';

/**
 * WhatsApp message the CecureUs team receives for a new account request.
 * Plain text, one field per line, so it is easy to copy into the admin panel.
 */
export function registrationMessage(r: RegistrationRequest): string {
  const name = [r.firstName, r.lastName].filter(Boolean).join(' ');
  const lines = [
    'New CecureUs account request',
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
  lines.push('', 'Sent from the CecureUs app. Please add me so I can sign in with my mobile number.');
  return lines.join('\n');
}

export function validateCompanyName(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Company name is required.';
  if (v.length > 100) return 'Company name is too long.';
  return null;
}
