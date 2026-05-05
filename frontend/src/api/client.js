const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function handleResponse(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export async function parseFloorplan(imageFile) {
  const form = new FormData()
  form.append('image', imageFile)
  return handleResponse(await fetch(`${BASE_URL}/api/parse`, { method: 'POST', body: form }))
}

export async function startParseJob(imageFile) {
  const form = new FormData()
  form.append('image', imageFile)
  return handleResponse(await fetch(`${BASE_URL}/api/parse/jobs`, { method: 'POST', body: form }))
}

export async function getParseJob(jobId) {
  return handleResponse(await fetch(`${BASE_URL}/api/parse/jobs/${jobId}`))
}

export async function buildPromptFromParse(parseResult, brandPreset = 'modern') {
  return handleResponse(
    await fetch(`${BASE_URL}/api/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parse_result: parseResult, brand_preset: brandPreset }),
    }),
  )
}

export async function generateRender(imageFile, parseResult, brandPreset = 'modern', promptOverride = '') {
  const form = new FormData()
  form.append('image', imageFile)
  form.append('parse_result', JSON.stringify(parseResult))
  form.append('brand_preset', brandPreset)
  form.append('prompt_override', promptOverride ?? '')
  return handleResponse(await fetch(`${BASE_URL}/api/generate`, { method: 'POST', body: form }))
}

export async function startGenerateJob(imageFile, parseResult, brandPreset = 'modern', promptOverride = '') {
  const form = new FormData()
  form.append('image', imageFile)
  form.append('parse_result', JSON.stringify(parseResult))
  form.append('brand_preset', brandPreset)
  form.append('prompt_override', promptOverride ?? '')
  return handleResponse(await fetch(`${BASE_URL}/api/generate/jobs`, { method: 'POST', body: form }))
}

export async function getGenerateJob(jobId) {
  return handleResponse(await fetch(`${BASE_URL}/api/generate/jobs/${jobId}`))
}
