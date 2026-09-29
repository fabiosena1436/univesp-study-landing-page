import type { OptionT } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";

export type DisplayQuestion = {
  id?: string;
  statement: string;
  options: OptionT[];
  correctKey?: string | null;
};

export function QuestionCard({
  q,
  index,
  showAnswer = true,
}: {
  q: DisplayQuestion;
  index?: number | string;
  showAnswer?: boolean;
}) {
  return (
    <article className="card p-5 md:p-6 anim-fade-up">
      <div className="flex items-start gap-3">
        {index !== undefined && (
          <span className="shrink-0 w-8 h-8 rounded-lg bg-ink text-paper grid place-items-center text-sm font-bold font-display">
            {index}
          </span>
        )}
        <p className="whitespace-pre-line text-[15px] leading-relaxed flex-1">
          {q.statement || <span className="text-muted italic">Sem enunciado.</span>}
        </p>
      </div>
      {q.options.length > 0 && (
        <ul className="mt-4 space-y-2">
          {q.options.map((o) => {
            const isCorrect = showAnswer && q.correctKey === o.key;
            const dimmed = showAnswer && !!q.correctKey && !isCorrect;
            return (
              <li
                key={o.key}
                className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                  isCorrect ? "border-green/40 bg-green-soft" : "border-line bg-surface"
                } ${dimmed ? "opacity-75" : ""}`}
              >
                <span
                  className={`shrink-0 w-7 h-7 rounded-lg grid place-items-center text-xs font-bold border ${
                    isCorrect
                      ? "bg-green text-white border-green"
                      : "bg-card border-line-strong text-ink"
                  }`}
                >
                  {o.key}
                </span>
                <span className="whitespace-pre-line pt-1 leading-relaxed flex-1">{o.text}</span>
                {isCorrect && <CheckCircle2 className="ml-auto shrink-0 text-green mt-1.5" size={18} />}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
