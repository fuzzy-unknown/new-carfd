const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const IMAGE_API = "https://api.openai.com/v1/images/generations";

/**
 * OpenAI client for DALL-E image generation
 */
export class OpenAIClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || OPENAI_API_KEY;
  }

  /**
   * Generate image using GPT Image 2, DALL-E 2 or DALL-E 3
   */
  async generateImage(options: {
    prompt: string;
    model?: "gpt-image-2" | "dall-e-2" | "dall-e-3";
    size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792" | "2048x2048" | "4096x4096";
    quality?: "standard" | "hd";
    style?: "vivid" | "natural";
    mode?: "instant" | "thinking";
    n?: number;
  }): Promise<{ url: string; revisedPrompt?: string }> {
    const {
      prompt,
      model = "gpt-image-2",
      size = "1024x1024",
      quality = "standard",
      style = "vivid",
      mode = "instant",
      n = 1,
    } = options;

    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    console.log("[openai-client] generateImage request:", {
      model,
      size,
      quality,
      style,
      mode,
      promptLen: prompt.length,
    });

    const body: any = {
      model,
      prompt,
      n,
      size,
    };

    // GPT Image 2 specific parameters
    if (model === "gpt-image-2") {
      body.mode = mode;
      // GPT Image 2 supports higher resolutions
      if (size === "4096x4096" || size === "2048x2048") {
        body.size = size;
      }
    }

    // DALL-E 3 specific parameters
    if (model === "dall-e-3") {
      body.quality = quality;
      body.style = style;
    }

    const response = await fetch(IMAGE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorBody: any;
      try {
        errorBody = await response.json();
      } catch {
        throw new Error(`HTTP ${response.status}: OpenAI service error`);
      }
      console.error("[openai-client] generateImage ERROR:", JSON.stringify(errorBody, null, 2));
      throw new Error(errorBody.error?.message || "OpenAI image generation failed");
    }

    const result = await response.json();

    if (result.error) {
      console.error("[openai-client] generateImage API error:", JSON.stringify(result.error, null, 2));
      throw new Error(result.error.message || "OpenAI image generation failed");
    }

    const imageUrl = result.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("OpenAI did not return an image URL");
    }

    return {
      url: imageUrl,
      revisedPrompt: result.data?.[0]?.revised_prompt,
    };
  }
}
