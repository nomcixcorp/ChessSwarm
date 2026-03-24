import type { AiInsightsRequest, AiInsightsResult } from "@chess-swarm/shared-types";

import { buildDeterministicFallbackInsights } from "./fallback.js";
import { createOpenAiInsightsProvider, type AiInsightsProvider } from "./openai-provider.js";

export interface GenerateAiInsightsDependencies {
  createProvider?: () => AiInsightsProvider | null;
}

export async function generateAiInsights(
  request: AiInsightsRequest,
  deps: GenerateAiInsightsDependencies = {},
): Promise<AiInsightsResult> {
  const providerFactory = deps.createProvider ?? createOpenAiInsightsProvider;
  const provider = providerFactory();
  if (!provider) {
    return buildDeterministicFallbackInsights(request, "missing_api_key");
  }

  const providerResult = await provider.generate(request);
  if (!providerResult) {
    return buildDeterministicFallbackInsights(request, "provider_error");
  }

  return providerResult;
}
