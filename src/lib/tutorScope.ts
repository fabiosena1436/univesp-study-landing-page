export const tutorPages = {
  "/app": "Painel",
  "/app/plano": "Meu plano de estudo",
  "/app/flashcards": "Flashcards",
  "/app/prova": "Nova prova",
  "/app/materiais": "Materiais (PDF)",
  "/app/questoes": "Banco de questões",
  "/app/importar": "Importar questões",
  "/app/historico": "Histórico",
  "/app/perfil": "Perfil / Minha conta",
  "/app/contato": "Falar com admin",
  "/app/admin": "Administração",
} as const;

export type TutorPage = keyof typeof tutorPages;
export type TutorScope = { subjectId?: string; materialId?: string; questionId?: string; page?: TutorPage };

export function isTutorPage(value: unknown): value is TutorPage {
  return typeof value === "string" && Object.hasOwn(tutorPages, value);
}

export function tutorPageFromPath(path: string): TutorPage {
  return isTutorPage(path) ? path : "/app";
}
