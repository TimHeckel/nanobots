export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export function defaultProviderConfig(): ProviderConfig {
  return {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    model: "meta-llama/llama-4-maverick",
    baseUrl: "https://openrouter.ai/api/v1",
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function chat(
  config: ProviderConfig,
  messages: ChatMessage[],
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(
      "No API key configured. Set OPENROUTER_API_KEY or run `nanobots auth`.",
    );
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "HTTP-Referer": "https://nanobots.sh",
          "X-Title": "nanobots-cli",
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.1,
          max_tokens: 4096,
        }),
      });

      if (response.status === 429) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `OpenRouter API error (${response.status}): ${body}`,
        );
      }

      const data = (await response.json()) as OpenRouterResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Empty response from OpenRouter API");
      }

      return content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError ?? new Error("Failed after retries");
}
