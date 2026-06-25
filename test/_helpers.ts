/** Strip ANSI colour codes so assertions can match plain text. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
export const stripAnsi = (s: string): string => s.replace(ANSI, '');
