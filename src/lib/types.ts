export type User = {
  id: string;
  name: string;
  email: string;
  course: string | null;
  createdAt: string;
  isAdmin?: boolean;
};

export type Subject = {
  id: string;
  name: string;
  color: string;
  questionCount: number;
  readyQuestionCount?: number;
};

export type OptionT = { key: string; text: string };

export type QuestionDB = {
  id: string;
  subjectId: string;
  materialId: string | null;
  source: string;
  statement: string;
  options: OptionT[];
  correctKey: string | null;
  feedback: string | null;
  createdAt: string;
};

export type MaterialRow = {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  filename: string;
  pageCount: number;
  charCount: number;
  questionCount: number;
  createdAt: string;
};

export type MaterialDetail = {
  id: string;
  subjectId: string;
  title: string;
  filename: string;
  pageCount: number;
  charCount: number;
  content: string;
  createdAt: string;
};

export type GenerateResponse = {
  engine: "gemini" | "local";
  note: string | null;
  available: number;
  questions: ParsedQuestion[];
};

export type ParsedQuestion = {
  tempId: string;
  statement: string;
  options: OptionT[];
  correctKey: string | null;
  feedback: string;
  warnings: string[];
  sourceExcerpt?: string;
};

export type QuizQuestion = {
  id: string;
  statement: string;
  options: OptionT[];
  correctKey: string | null;
  feedback: string | null;
};

export type AnswerRecord = {
  questionId: string;
  selectedKey: string | null;
  isCorrect: boolean;
};

export type AttemptRow = {
  id: string;
  subjectId: string;
  subjectName: string;
  total: number;
  correctCount: number;
  durationSec: number;
  createdAt: string;
};

export type AttemptDetailAnswer = {
  statement: string;
  options: OptionT[];
  correctKey: string | null;
  feedback: string | null;
  selectedKey: string | null;
  isCorrect: boolean;
};

export type AttemptDetail = {
  id: string;
  subjectName: string;
  total: number;
  correctCount: number;
  durationSec: number;
  createdAt: string;
  answers: AttemptDetailAnswer[];
};

export type ReviewQuestion = {
  id: string;
  subjectId: string;
  subjectName: string;
  statement: string;
  options: OptionT[];
  correctKey: string | null;
  feedback: string | null;
  dueAt: string;
  repetitions: number;
  intervalDays: number;
};

export type StudyPlan = {
  due: ReviewQuestion[];
  dueCount: number;
  totalTracked: number;
  masteredCount: number;
  reviewedToday: number;
};

export type Flashcard = {
  id: string;
  subjectId: string;
  subjectName: string;
  front: string;
  back: string;
  feedback: string | null;
};
