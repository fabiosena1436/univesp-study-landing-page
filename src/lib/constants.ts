export const SUBJECT_COLORS = [
  "#FFD43B",
  "#8FD694",
  "#F2A68C",
  "#9BB8F5",
  "#D3A8F0",
  "#7BD8C4",
  "#FF9FBE",
  "#C9BFA8",
];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const UNIVESP_STUDENT_EMAIL_RE = /^[^\s@]+@aluno\.univesp\.br$/i;

const STUDENT_EMAIL_EXCEPTIONS = new Set(["fabiosena1436@gmail.com"]);
export function registrationEmailAllowed(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return UNIVESP_STUDENT_EMAIL_RE.test(normalized) || STUDENT_EMAIL_EXCEPTIONS.has(normalized);
}

export const BRAND = "Aprova UNIVESP";
