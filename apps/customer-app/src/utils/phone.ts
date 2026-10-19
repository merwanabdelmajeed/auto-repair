// As-you-type US phone formatting for the signup form: "9495551234" →
// "(949) 555-1234". Display formatting only — the number is never validated
// or verified, and is stored as the formatted string. A leading US country
// code ("+1 949…", "1949…") is dropped so pasted numbers still format.
export function formatPhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);

  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
