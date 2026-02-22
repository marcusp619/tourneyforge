import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { ImageBlockParam } from "@anthropic-ai/sdk/resources/messages.js";

export const aiRouter = new Hono();

function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

const verifyCatchSchema = z
  .object({
    /** Public URL of an already-uploaded image (preferred for existing catches) */
    imageUrl: z.string().url().optional(),
    /** base64-encoded image data (for direct photo uploads) */
    imageBase64: z.string().min(1).optional(),
    /** MIME type — required when using imageBase64 */
    mediaType: z
      .enum(["image/jpeg", "image/png", "image/webp", "image/gif"])
      .optional()
      .default("image/jpeg"),
    /** Expected species name (from tournament species list) */
    expectedSpecies: z.string().optional(),
  })
  .refine((d) => d.imageUrl ?? d.imageBase64, {
    message: "Either imageUrl or imageBase64 must be provided",
  });

export interface CatchVerificationResult {
  isValidFish: boolean;
  detectedSpecies: string | null;
  confidence: "high" | "medium" | "low";
  estimatedWeightOz: number | null;
  estimatedLengthIn: number | null;
  notes: string;
  autoApproved: boolean;
}

const VERIFY_PROMPT = (speciesHint: string) => `You are a professional fishing tournament judge verifying catch submissions.

Analyze this fish photo carefully. ${speciesHint}

Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{
  "isValidFish": true/false,
  "detectedSpecies": "species common name or null",
  "confidence": "high" | "medium" | "low",
  "estimatedWeightOz": number or null,
  "estimatedLengthIn": number or null,
  "notes": "brief observation for the tournament director"
}

Rules:
- isValidFish: true only if this is clearly a real fish being held or measured
- detectedSpecies: the most likely species, or null if unclear or not a fish
- confidence: high if species is clearly identifiable, medium if likely, low if unclear
- estimatedWeightOz: rough estimate in ounces based on visible size, or null
- estimatedLengthIn: rough estimate in inches based on visible scale/ruler, or null
- notes: 1-2 sentences for the judge. Flag any concerns (blurry, unclear, wrong species, etc.)`;

/**
 * POST /api/ai/verify-catch
 *
 * Accepts a fish photo (URL or base64) and uses Claude claude-haiku-4-5 to:
 * - Confirm it's actually a fish
 * - Identify the species
 * - Estimate size/weight
 * - Return a structured verification result
 */
aiRouter.post(
  "/verify-catch",
  zValidator("json", verifyCatchSchema),
  async (c) => {
    const anthropic = getAnthropic();
    if (!anthropic) {
      return c.json(
        { error: { code: "AI_NOT_CONFIGURED", message: "AI verification is not configured" } },
        503
      );
    }

    const { imageUrl, imageBase64, mediaType, expectedSpecies } = c.req.valid("json");

    const speciesHint = expectedSpecies
      ? `The angler says this is a ${expectedSpecies}.`
      : "";

    // Build the image block for Anthropic
    let imageBlock: ImageBlockParam;
    if (imageUrl) {
      imageBlock = {
        type: "image",
        source: { type: "url", url: imageUrl },
      };
    } else {
      imageBlock = {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType ?? "image/jpeg",
          data: imageBase64!,
        },
      };
    }

    try {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              imageBlock,
              { type: "text", text: VERIFY_PROMPT(speciesHint) },
            ],
          },
        ],
      });

      const textContent = message.content.find((b) => b.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text response from AI");
      }

      // Strip any accidental markdown code fences
      const raw = textContent.text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(raw) as Omit<CatchVerificationResult, "autoApproved">;

      // Auto-approve if high confidence valid fish matching expected species
      const autoApproved =
        parsed.isValidFish &&
        parsed.confidence === "high" &&
        (!expectedSpecies ||
          (parsed.detectedSpecies ?? "")
            .toLowerCase()
            .includes((expectedSpecies.toLowerCase().split(" ")[0]) ?? ""));

      const result: CatchVerificationResult = { ...parsed, autoApproved };

      return c.json({ data: result });
    } catch (err) {
      console.error("[ai/verify-catch] error:", err);
      return c.json(
        { error: { code: "AI_ERROR", message: "AI verification failed. Please try again." } },
        500
      );
    }
  }
);
