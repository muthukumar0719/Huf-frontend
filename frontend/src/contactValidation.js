// Format validation only; ownership requires OTP/email verification.
export function mobileError(value) {
  if (typeof value !== 'string' || !value) return 'Enter your mobile number.';
  return /^[6-9]\d{9}$/.test(value) ? '' : 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.';
}
export function emailError(value) {
  if (typeof value !== 'string' || !value.trim()) return 'Enter your email address.';
  const email=value.trim();
  const parts=email.split('@');
  if (email.length>254 || parts.length!==2) return 'Enter a valid email address, such as name@example.com.';
  const [local,domain]=parts;
  const labels=domain.split('.');
  const valid=local.length>0 && local.length<=64 && /^[A-Za-z0-9!#$%&'*+/=?^_\x60{|}~.-]+$/.test(local) && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') && labels.length>=2 && labels.every(label=>/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label)) && /^[A-Za-z]{2,63}$/.test(labels.at(-1));
  return valid ? '' : 'Enter a valid email address, such as name@example.com.';
}
// The applicant's email must be a Gmail address: name@gmail.com.
export const GMAIL_DOMAIN = 'gmail.com';
export function gmailError(value) {
  const basic = emailError(value);
  if (basic) return basic;
  const [local, domain] = value.trim().split('@');
  if (domain.toLowerCase() !== GMAIL_DOMAIN) return 'Only Gmail addresses are allowed: the email must end with @gmail.com.';
  return /^[A-Za-z0-9.+]+$/.test(local) ? '' : 'Gmail name can contain only letters, numbers, dots (.) and +.';
}
