"use client";

import { useState } from "react";
import type { CrisisNode } from "@/lib/data/crisis/types";

export default function DecisionQuiz({
  quiz, onAnswer,
}: {
  quiz?: CrisisNode["quiz"];
  onAnswer: (correct: boolean) => void;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [counted, setCounted] = useState(false);

  if (!quiz) return null;

  const answered = chosen !== null;

  const pick = (i: number) => {
    if (answered) return;
    setChosen(i);
    if (!counted) {
      setCounted(true);
      onAnswer(i === quiz.answer);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">决策测验 · 你会怎么做？</p>
      <p className="text-sm font-medium leading-relaxed mb-3">{quiz.question}</p>
      <div className="space-y-2">
        {quiz.options.map((opt, i) => {
          const isCorrect = i === quiz.answer;
          const isChosen = i === chosen;
          let cls = "border-border bg-card hover:border-primary/60";
          if (answered) {
            if (isCorrect) cls = "border-down bg-down/10 text-down";
            else if (isChosen) cls = "border-primary bg-primary/10 text-primary";
            else cls = "border-border bg-card opacity-50";
          }
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => pick(i)}
              className={`w-full text-left px-3 py-2.5 rounded-md border text-sm transition-colors ${cls}`}
            >
              <span className="font-mono text-xs mr-2">{String.fromCharCode(65 + i)}.</span>
              {opt}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-3 rounded-md border-l-4 border-primary bg-primary/5 p-3">
          <p className="text-xs font-semibold mb-1">
            {chosen === quiz.answer ? (
              <span className="up">回答正确</span>
            ) : (
              <span className="down">回答错误 · 正确选项 {String.fromCharCode(65 + quiz.answer)}</span>
            )}
            <span className="text-muted font-normal ml-2">专业点评</span>
          </p>
          <p className="text-[13px] leading-relaxed text-foreground/90">{quiz.insight}</p>
        </div>
      )}
    </div>
  );
}