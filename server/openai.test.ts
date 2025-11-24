import { describe, expect, it } from "vitest";
import { invokeLLM } from "./_core/llm";

describe("OpenAI API Key Validation", () => {
  it("should successfully call OpenAI API with provided key", async () => {
    // Simple test to verify the API key works
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say 'hello' in one word." },
      ],
    });

    expect(response).toBeDefined();
    expect(response.choices).toBeDefined();
    expect(response.choices.length).toBeGreaterThan(0);
    expect(response.choices[0]?.message?.content).toBeDefined();
    
    const content = response.choices[0]?.message?.content;
    expect(typeof content === "string" || Array.isArray(content)).toBe(true);
  }, 30000); // 30 second timeout for API call
});
