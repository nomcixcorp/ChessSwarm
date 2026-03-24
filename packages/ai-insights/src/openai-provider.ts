import OpenAI from "openai";
import type { AiInsightsRequest, AiInsightsResult } from "@chess-swarm/shared-types";
import { createGroundedPrompt } from "./prompts.js";

const MODEL_NAME = "gpt-4.1-mini";

interface OpenAiInsightsSchema {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  openingRecommendation: string;
  tacticalRecommendation: string;
  trainingPlan: Array<{
    title: string;
    rationale: string;
    category: string;
  }>;
  caveats: string;
  confidence: "low" | "medium" | "high";
  groundedMetricRefs: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isTrainingPlanArray(
  value: unknown,
): value is Array<{ title: string; rationale: string; category: string }> {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as { title?: unknown }).title === "string" &&
        typeof (entry as { rationale?: unknown }).rationale === "string" &&
        typeof (entry as { category?: unknown }).category === "string",
    )
  );
}

function parseResponseJson(content: string): OpenAiInsightsSchema {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  if (
    typeof parsed.summary !== "string" ||
    !isStringArray(parsed.strengths) ||
    !isStringArray(parsed.weaknesses) ||
    typeof parsed.openingRecommendation !== "string" ||
    typeof parsed.tacticalRecommendation !== "string" ||
    !isTrainingPlanArray(parsed.trainingPlan) ||
    typeof parsed.caveats !== "string" ||
    (parsed.confidence !== "low" && parsed.confidence !== "medium" && parsed.confidence !== "high") ||
    !isStringArray(parsed.groundedMetricRefs)
  ) {
    throw new Error("OpenAI insights payload did not match expected schema.");
  }

  return parsed as unknown as OpenAiInsightsSchema;
}

export async function generateAiInsightsWithOpenAi(
  request: AiInsightsRequest,
  apiKey: string,
): Promise<AiInsightsResult> {
  const client = new OpenAI({
    apiKey,
  });

  const completion = await client.responses.create({
    model: MODEL_NAME,
    input: createGroundedPrompt(request),
  });

  const outputText = completion.output_text?.trim();
  if (!outputText) {
    throw new Error("OpenAI response contained no text output.");
  }

  const parsed = parseResponseJson(outputText);
  const summary = `${parsed.summary}\n\nOpening recommendation: ${parsed.openingRecommendation}\nTactical recommendation: ${parsed.tacticalRecommendation}\nCaveats: ${parsed.caveats}\nConfidence: ${parsed.confidence}.`;

  return {
    summary,
    strengths: parsed.strengths,
    weaknesses: parsed.weaknesses,
    openingRecommendation: parsed.openingRecommendation,
    tacticalRecommendation: parsed.tacticalRecommendation,
    trainingPlan: parsed.trainingPlan,
    caveats: [parsed.caveats],
    confidence: parsed.confidence === "high" ? 0.85 : parsed.confidence === "medium" ? 0.65 : 0.45,
    groundedMetricRefs: parsed.groundedMetricRefs,
  };
}

export interface AiInsightsProvider {
  generate(request: AiInsightsRequest): Promise<AiInsightsResult | null>;
}

class OpenAiInsightsProvider implements AiInsightsProvider {
  private readonly apiKey: string;

  public constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async generate(request: AiInsightsRequest): Promise<AiInsightsResult | null> {
    try {
      return await generateAiInsightsWithOpenAi(request, this.apiKey);
    } catch {
      return null;
    }
  }
}

export function createOpenAiInsightsProvider(): AiInsightsProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAiInsightsProvider(apiKey);
}
