import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AiUnavailable } from "./ai";

// One model for everything, so changing it is a one-line edit.
export const GEMINI_MODEL = "gemini-3.8-flash";
const TIMEOUT_MS = 25_000;

export type GeminiInput = ReadonlyArray<
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string }
>;

export type GeminiRequest = {
  system: string;
  input: GeminiInput;
  /** The shape the answer must have, as JSON Schema. */
  schema: Record<string, unknown>;
};

// Sends one request and returns the model's raw JSON text. Swapped for a stand-in in tests.
export type GeminiTransport = (request: GeminiRequest) => Promise<string>;

// What an error from the SDK says about the service: out of quota, down, or too slow. Those mean "use
// another way" to the person; anything else is a bug worth seeing.
export function isUnavailable(error: unknown): boolean {
  if (error instanceof AiUnavailable) return true;
  const e = error as {
    name?: string;
    status?: unknown;
    statusCode?: unknown;
    message?: unknown;
    cause?: unknown;
  } | null;
  const status = Number(e?.status ?? e?.statusCode);
  if (status === 429 || (status >= 500 && status <= 599)) return true;
  if (/timeout|connection|aborted/i.test(String(e?.name))) return true;
  if (
    /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|quota|rate limit|overloaded/i.test(
      String(e?.message),
    )
  ) {
    return true;
  }
  return e?.cause ? isUnavailable(e.cause) : false;
}

// A line for the server log saying why a request failed: the kind of error, its status and Google's
// reason (cut short). The API key and what was sent are never part of an SDK error message.
export function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return "unknown error";
  const status = (error as { status?: unknown }).status;
  const where = typeof status === "number" ? ` (${status})` : "";
  return `${error.name}${where}: ${error.message.slice(0, 300)}`;
}

// The real thing: the Gemini API's Interactions endpoint, asked for JSON and told not to keep it.
export function geminiTransport(apiKey: string): GeminiTransport {
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: TIMEOUT_MS },
  });
  return async ({ system, input, schema }) => {
    try {
      const interaction = await client.interactions.create({
        model: GEMINI_MODEL,
        // Google does not keep what was sent (free-tier data use is covered in Settings → About).
        store: false,
        system_instruction: system,
        input: [...input],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema,
        },
        generation_config: { thinking_level: "minimal" },
      });
      const text = interaction.output_text;
      if (!text) throw new Error("Gemini returned no text");
      return text;
    } catch (error) {
      console.error(`Gemini request failed: ${describeFailure(error)}`);
      if (isUnavailable(error)) {
        throw new AiUnavailable(
          error instanceof Error ? error.name : "unknown error",
        );
      }
      throw error;
    }
  };
}

// Reads the model's JSON against a schema, so only the shape asked for ever gets through.
export function parseModelJson<T extends z.ZodType>(
  text: string,
  schema: T,
): z.infer<T> {
  return schema.parse(JSON.parse(text));
}

export const jsonSchema = (schema: z.ZodType): Record<string, unknown> =>
  z.toJSONSchema(schema) as Record<string, unknown>;
