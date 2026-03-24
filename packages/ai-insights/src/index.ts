export { buildGroundedMetricsSnapshot, buildPromptMessages } from "./prompts.js";
export { buildDeterministicFallbackInsights } from "./fallback.js";
export {
  generateAiInsights,
  type GenerateAiInsightsDependencies,
} from "./service.js";
export {
  createOpenAiInsightsProvider,
  generateAiInsightsWithOpenAi,
  type AiInsightsProvider,
} from "./openai-provider.js";
