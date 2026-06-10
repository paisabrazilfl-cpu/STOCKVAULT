import os
from openai import OpenAI

def get_deepseek_client():
    api_key = os.environ.get("NVIDIA_API_KEY")
    if not api_key:
        raise ValueError("NVIDIA_API_KEY environment variable is not set")
    
    client = OpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=api_key
    )
    return client

def send_deepseek(prompt: str) -> str:
    client = get_deepseek_client()
    completion = client.chat.completions.create(
        model="deepseek-ai/deepseek-v4-pro",
        messages=[{"role": "user", "content": prompt}],
        temperature=1,
        top_p=0.95,
        max_tokens=16384,
        extra_body={"chat_template_kwargs": {"thinking": False}},
        stream=False
    )
    return completion.choices[0].message.content
