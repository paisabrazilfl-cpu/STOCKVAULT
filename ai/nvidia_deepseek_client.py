import os
from openai import OpenAI

# Load API key from environment. The OpenAI SDK requires a key at init; 
# if the env var is missing, it will naturally fail on API call, which is correct.
# We pass it directly to ensure no hardcoded secrets exist in the codebase.
client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.environ.get("NVIDIA_API_KEY")
)

def send_deepseek(prompt: str) -> str:
    """
    Sends a prompt to deepseek-ai/deepseek-v4-pro via NVIDIA API.
    Configuration: temperature=1, top_p=0.95, max_tokens=16384, thinking=False
    """
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
