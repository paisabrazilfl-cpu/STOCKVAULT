from openai import OpenAI
import os

client = OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=os.environ.get("NVIDIA_API_KEY"))

def send_deepseek(prompt: str) -> str:
    completion = client.chat.completions.create(
        model="deepseek-ai/deepseek-v4-pro",
        temperature=1,
        top_p=0.95,
        max_tokens=16384,
        extra_body={"chat_template_kwargs": {"thinking": False}},
        messages=[{"role": "user", "content": prompt}],
        stream=False
    )
    return completion.choices[0].message.content
