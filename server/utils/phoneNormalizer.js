/**
 * Normalizes a phone number to standard E.164 format.
 * Defaults to Indian country code (+91) for 10-digit mobile numbers.
 *
 * @param {string|number} rawPhone
 * @returns {string|null} Normalized E.164 phone number, or null if invalid
 */
export const normalizePhoneNumber = (rawPhone) => {
  if (!rawPhone) return null;
  const str = String(rawPhone).trim();

  // Strip all whitespace, hyphens, parenthesis, dots
  let cleaned = str.replace(/[\s\-\(\)\.]/g, '');

  if (!cleaned) return null;

  // If starts with +, inspect remaining digits
  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.slice(1);
    if (!/^\d{7,15}$/.test(digitsOnly)) return null;
    return `+${digitsOnly}`;
  }

  // Digits only check
  if (!/^\d+$/.test(cleaned)) return null;

  // Handle standard Indian mobile numbers
  // 10 digits starting with 6, 7, 8, or 9
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // 11 digits starting with 0 followed by 6, 7, 8, or 9 (e.g. 09876543210)
  if (cleaned.length === 11 && cleaned.startsWith('0') && /^[6-9]/.test(cleaned.slice(1))) {
    return `+91${cleaned.slice(1)}`;
  }

  // 12 digits starting with 91 (e.g. 919876543210)
  if (cleaned.length === 12 && cleaned.startsWith('91') && /^[6-9]/.test(cleaned.slice(2))) {
    return `+${cleaned}`;
  }

  // General 10 digits
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  // International 11-15 digits
  if (cleaned.length >= 11 && cleaned.length <= 15) {
    return `+${cleaned}`;
  }

  return null;
};

/**
 * Validates whether a phone number can be normalized to a valid E.164 number.
 *
 * @param {string|number} rawPhone
 * @returns {boolean}
 */
export const isValidPhoneNumber = (rawPhone) => {
  return normalizePhoneNumber(rawPhone) !== null;
};
