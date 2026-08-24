// The password policy, in one place. It used to be copy-pasted into three:
// the create-password form, the admin add-teacher modal, and the create-teacher
// route — so the client checklist and the server's 400 could drift apart
// without anyone noticing.
export const PASSWORD_RULES = [
  { key: "length", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { key: "number", label: "One number", test: (p: string) => /\d/.test(p) },
  { key: "special", label: "One special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export type PasswordRuleKey = (typeof PASSWORD_RULES)[number]["key"];

export type PasswordRuleResult = {
  key: PasswordRuleKey;
  label: string;
  met: boolean;
};

// For the forms: every rule with its label and whether it passes, so the
// checklist can render one row per rule without restating the labels.
export function checkPassword(password: string): PasswordRuleResult[] {
  return PASSWORD_RULES.map((rule) => ({
    key: rule.key,
    label: rule.label,
    met: rule.test(password),
  }));
}

// For the server: the same rules as a single boolean.
export function isValidPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

// The one-line version, for server responses that can't render a checklist.
export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be at least 8 characters with 1 uppercase letter, 1 number and 1 special character.";
