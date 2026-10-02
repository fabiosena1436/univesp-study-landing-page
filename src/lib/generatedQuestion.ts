import type { OptionT } from "./types";
export type GeneratedQuestion = {
  statement: string;
  options: OptionT[];
  correctKey: string | null;
  feedback: string;
  sourceExcerpt?: string;
};
