import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}
