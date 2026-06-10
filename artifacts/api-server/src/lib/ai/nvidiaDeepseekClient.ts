import OpenAI from 'openai';

export function getDeepseekClient(): OpenAI {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
        throw new Error("NVIDIA_API_KEY environment variable is not set");
    }
    return new OpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: apiKey,
    });
}

export async function sendDeepseek(prompt: string): Promise<string> {
    const client = getDeepseekClient();
    const completion = await client.chat.completions.create({
        model: "deepseek-ai/deepseek-v4-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 1,
        top_p: 0.95,
        max_tokens: 16384,
        // @ts-ignore - extra_body is supported by NVIDIA's OpenAI-compatible endpoint
        extra_body: { chat_template_kwargs: { thinking: false } },
        stream: false,
    });
    return completion.choices[0].message.content || "";
}
