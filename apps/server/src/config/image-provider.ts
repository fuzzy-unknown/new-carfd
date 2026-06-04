export type ImageProvider = "dashscope" | "openai";

export interface ImageProviderConfig {
  provider: ImageProvider;
  model?: string; // For DashScope: "qwen-image-2.0-pro", for OpenAI: "dall-e-2" or "dall-e-3"
}

/**
 * Get the image provider configuration from environment variables
 * Defaults to OpenAI (gpt-image-2) if IMAGE_PROVIDER is not set
 */
export function getImageProviderConfig(): ImageProviderConfig {
  const provider = (process.env.IMAGE_PROVIDER as ImageProvider) || "openai";
  const model = process.env.IMAGE_MODEL;

  return {
    provider,
    model: model || (provider === "openai" ? "gpt-image-2" : "qwen-image-2.0-pro"),
  };
}
