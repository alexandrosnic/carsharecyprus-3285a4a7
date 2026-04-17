// Allowed country codes: Cyprus + EU member states.
// Defence in depth on top of Twilio Geo Permissions.
export const ALLOWED_COUNTRY_CODES = [
  '357', // Cyprus
  '43',  // Austria
  '32',  // Belgium
  '359', // Bulgaria
  '385', // Croatia
  '420', // Czechia
  '45',  // Denmark
  '372', // Estonia
  '358', // Finland
  '33',  // France
  '49',  // Germany
  '30',  // Greece
  '36',  // Hungary
  '353', // Ireland
  '39',  // Italy
  '371', // Latvia
  '370', // Lithuania
  '352', // Luxembourg
  '356', // Malta
  '31',  // Netherlands
  '48',  // Poland
  '351', // Portugal
  '40',  // Romania
  '421', // Slovakia
  '386', // Slovenia
  '34',  // Spain
  '46',  // Sweden
];

/**
 * Validates an E.164 phone number is from Cyprus or an EU country.
 * Expects format: +<country><number>, total 7-15 digits after +.
 */
export const validateEUPhone = (phone: string): { valid: boolean; error?: string } => {
  const trimmed = phone.trim().replace(/\s+/g, '');
  if (!trimmed.startsWith('+')) {
    return { valid: false, error: 'Phone must start with + and country code (e.g. +357)' };
  }
  const digits = trimmed.slice(1);
  if (!/^\d{7,15}$/.test(digits)) {
    return { valid: false, error: 'Phone must contain 7–15 digits after the country code' };
  }
  const matched = ALLOWED_COUNTRY_CODES.find((cc) => digits.startsWith(cc));
  if (!matched) {
    return { valid: false, error: 'Only Cyprus and EU phone numbers are accepted' };
  }
  return { valid: true };
};

export const normalizePhone = (phone: string): string =>
  phone.trim().replace(/\s+/g, '');
