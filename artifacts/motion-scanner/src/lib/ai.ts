export async function callMistralAI(prompt: string) {
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer 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',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      model: 'mistralai/mistral-medium-3.5-128b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      top_p: 1.0,
      max_tokens: 1024,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error('NVIDIA API error: ' + response.status);
  }

  return response.json();
}
