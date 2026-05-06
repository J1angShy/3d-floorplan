import json
import os

from google import genai
from google.genai import types
from google.genai.errors import APIError

from services.gemini_fallback import is_transient_capacity_error, parse_model_chain

_PROMPT = """You are analysing a branding guide document to extract visual styling parameters for 3D architectural renders.

Return a JSON object with exactly these fields:
{
  "name": "short display name for this brand (e.g. 'Acme Realty', 'Modern Luxe')",
  "walls": "wall finish description with hex color if specified in the guide",
  "floor": "floor material and texture description",
  "furniture_style": "style keywords and upholstery descriptors",
  "accent_primary": "dominant brand color — include hex code if available",
  "accent_secondary": "secondary brand color — include hex code if available",
  "fixtures": "hardware and fixture finish (e.g. 'brushed brass', 'matte black (#1A1A1A)')",
  "lighting": "lighting character description",
  "greenery": "plant style preference, or 'none' if not specified"
}

Rules:
- Extract only what is explicitly stated or clearly shown in the document
- Include hex codes for any specified colors; describe by name if no hex is given
- Keep each value concise but specific — they feed directly into image generation prompts
- If a field cannot be determined from the document, use a tasteful neutral default appropriate to the brand's overall aesthetic
"""


def parse_brand_pdf(pdf_bytes: bytes) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError("GEMINI_API_KEY is not configured.")

    client = genai.Client(api_key=api_key)
    models_to_try = parse_model_chain()

    for idx, model in enumerate(models_to_try):
        try:
            response = client.models.generate_content(
                model=model,
                contents=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    _PROMPT,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            return json.loads(response.text)
        except APIError as exc:
            if is_transient_capacity_error(exc) and idx < len(models_to_try) - 1:
                continue
            raise exc

    raise RuntimeError("No parse models available.")
