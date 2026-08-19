"use client";

import { useState } from "react";
import { useFeelingSurvey } from "@/components/charts/Thermometer";

const QUESTIONS = [
  { key: "income", label: "收入", text: "过去一年，你的收入感受是？", options: ["大幅减少", "略有减少", "基本持平", "略有增加", "明显增加"], min: -2, max: 2 },
  { key: "job", label: "就业", text: "身边的就业环境（含你的行业）怎么样？", options: ["很差", "偏紧", "一般", "尚可", "很好"], min: -2, max: 2 },
  { key: "price", label: "物价", text: "日常消费价格感受是？", options: ["明显下跌", "略降", "平稳", "略涨", "明显上涨"], min: -2, max: 2 },
  { key: "housing", label: "房产", text: "房价 / 租金变动感受是？", options: ["明显下跌", "略降", "平稳", "略涨", "明显上涨"], min: -2, max: 2 },
  { key: "consume", label: "消费", text: "你愿意花钱的意愿比一年前？", options: ["弱很多", "弱一些", "差不多", "强一些", "强很多"], min: -2, max: 2 },
];

const AGE_GROUPS = ["18-25", "26-35", "36-45", "46-55", "56+"];
const OCCUPATIONS = ["企业职工", "个体经营", "公务员/事业单位", "自由职业", "学生", "退休", "待业", "其他"];
const REGIONS = ["华东", "华南", "华北", "华中", "西南", "西北", "东北"];

export default function FeelingSurvey() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [meta, setMeta] = useState({ ageGroup: "26-35", occupation: "企业职工", region: "华东" });
  const { result, error, loading, submit } = useFeelingSurvey();

  const setAnswer = (key: string, idx: number) => setAnswers((a) => ({ ...a, [key]: idx - 2 }));

  const canSubmit = QUESTIONS.every((q) => answers[q.key] !== undefined);

  if (result) {
    return (
      <div className="text-center py-8">
        <p className="text-5xl font-bold font-mono">{result.myScore}°</p>
        <p className="text-sm text-muted mt-2">你的个人体感温度</p>
        <p className="mt-4 text-sm">
          大众体感 {result.overall}°，当前参与样本 {result.sampleCount} 人
        </p>
        <p className="mt-2 text-xs text-muted">
          温差 {Math.round(result.myScore - result.overall) > 0 ? "+" : ""}{Math.round(result.myScore - result.overall)}°（你的感受 vs 大众平均）
        </p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-lg border border-border text-sm hover:border-primary/50">
          再测一次
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {QUESTIONS.map((q) => (
        <div key={q.key}>
          <p className="text-sm font-medium mb-1.5">{q.text}</p>
          <div className="flex gap-1.5 flex-wrap">
            {q.options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => setAnswer(q.key, i)}
                className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                  answers[q.key] === i - 2 ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/40"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <select value={meta.ageGroup} onChange={(e) => setMeta({ ...meta, ageGroup: e.target.value })} className="input">
          {AGE_GROUPS.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select value={meta.occupation} onChange={(e) => setMeta({ ...meta, occupation: e.target.value })} className="input">
          {OCCUPATIONS.map((g) => <option key={g}>{g}</option>)}
        </select>
        <select value={meta.region} onChange={(e) => setMeta({ ...meta, region: e.target.value })} className="input">
          {REGIONS.map((g) => <option key={g}>{g}</option>)}
        </select>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={() => submit({ ...answers, ...meta })}
        disabled={!canSubmit || loading}
        className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40"
      >
        {loading ? "提交中…" : "提交，看看你的体感温度"}
      </button>
    </div>
  );
}