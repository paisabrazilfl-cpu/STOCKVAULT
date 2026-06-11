import requests
import json

NVIDIA_API_KEY = "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"
INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

def query_nvidia_ai(prompt: str, stream: bool = False):
    headers = {
      "Authorization": f"Bearer {NVIDIA_API_KEY}",
      "Accept": "text/event-stream" if stream else "application/json"
    }
    payload = {
      "model": "mistralai/mistral-medium-3.5-128b",
      "reasoning_effort": "high",
      "messages": [{"role": "user", "content": prompt}],
      "max_tokens": 16384,
      "temperature": 0.70,
      "top_p": 1.00,
      "stream": stream
    }
    response = requests.post(INVOKE_URL, headers=headers, json=payload)
    if response.status_code != 200:
        return {"error": response.text, "status": response.status_code}
    return response.json()

if __name__ == "__main__":
    print(json.dumps(query_nvidia_ai("Confirm multi-tenant architecture status."), indent=2))
