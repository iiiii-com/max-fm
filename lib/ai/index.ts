import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type ModelId = "strong" | "cheap" | "default";

const MODELS: Record<ModelId, { id: string; baseURL: string; apiKey: string }> = {
  strong: {
    id: process.env.AI_STRONG_MODEL || "deepseek-chat",
    baseURL: process.env.AI_STRONG_BASE_URL || process.env.AI_BASE_URL || "https://api.deepseek.com/v1",
    apiKey: process.env.AI_STRONG_API_KEY || process.env.AI_API_KEY || "",
  },
  cheap: {
    id: process.env.AI_CHEAP_MODEL || "deepseek-chat",
    baseURL: process.env.AI_CHEAP_BASE_URL || process.env.AI_BASE_URL || "https://api.deepseek.com/v1",
    apiKey: process.env.AI_CHEAP_API_KEY || process.env.AI_API_KEY || "",
  },
  default: {
    id: process.env.AI_DEFAULT_MODEL || "deepseek-chat",
    baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com/v1",
    apiKey: process.env.AI_API_KEY || "",
  },
};

function provider(cfg: { baseURL: string; apiKey: string }) {
  return createOpenAICompatible({
    name: "max-ai",
    baseURL: cfg.baseURL,
    apiKey: cfg.apiKey,
  });
}

export function hasAI() {
  return !!(
    process.env.AI_API_KEY ||
    process.env.AI_STRONG_API_KEY ||
    process.env.AI_CHEAP_API_KEY
  );
}

export async function aiGenerate(
  prompt: string,
  opts: { model?: ModelId; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const cfg = MODELS[opts.model || "default"];
  if (!cfg.apiKey) {
    throw new Error("AI_API_KEY not configured");
  }
  const { text } = await generateText({
    model: provider(cfg)(cfg.id),
    prompt,
    maxOutputTokens: opts.maxTokens || 4096,
    temperature: opts.temperature ?? 0.7,
  });
  return text;
}

export async function aiGenerateOrFallback(
  prompt: string,
  fallback: string,
  opts: { model?: ModelId; maxTokens?: number } = {},
): Promise<string> {
  if (!hasAI()) return fallback;
  try {
    return await aiGenerate(prompt, opts);
  } catch {
    return fallback;
  }
}