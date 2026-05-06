import os
import io
import base64
from google import genai
from google.genai import types
from google.genai.errors import APIError
from PIL import Image, ImageDraw, ImageFont

from services.gemini_fallback import image_model_chain, is_transient_capacity_error


def _mock_render(prompt: str) -> tuple[str, str, bool, str]:
    image = Image.new("RGB", (1200, 800), "#050505")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()

    draw.rounded_rectangle((90, 70, 1110, 710), radius=28, fill="#141414", outline="#7B3F6E", width=4)
    draw.polygon([(270, 500), (600, 300), (930, 500), (600, 680)], fill="#D8C1A6", outline="#FFFFFF")
    draw.line([(270, 500), (600, 300), (930, 500), (600, 680), (270, 500)], fill="#FFFFFF", width=5)
    draw.line([(600, 300), (600, 680)], fill="#FFFFFF", width=4)
    draw.line([(435, 400), (765, 600)], fill="#FFFFFF", width=4)
    draw.ellipse((520, 445, 680, 530), fill="#7B3F6E")
    draw.rectangle((410, 520, 525, 595), fill="#F6F1EA")
    draw.rectangle((690, 385, 805, 460), fill="#F6F1EA")

    lines = [
        "MVP mock render",
        "Add GEMINI_API_KEY to enable Nano Banana generation.",
        "Brand constraints and parsed room prompt are already wired.",
    ]
    y = 110
    for line in lines:
        draw.text((130, y), line, fill="#F0F0F0", font=font)
        y += 28

    draw.text((130, 650), prompt[:140] + "...", fill="#8A8A8A", font=font)

    output = io.BytesIO()
    image.save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode("utf-8"), "image/png", True, "mock-local-render"


def generate_3d_render(image_bytes: bytes, prompt: str) -> tuple[str, str, bool, str]:
    """
    Sends the 2D floorplan image + deterministic brand prompt to Nano Banana 2.
    Returns (base64_encoded_image, mime_type, is_mock, image_model_used).
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        return _mock_render(prompt)

    image = Image.open(io.BytesIO(image_bytes))
    client = genai.Client(api_key=api_key)
    models_to_try = image_model_chain()
    for idx, generation_model in enumerate(models_to_try):
        try:
            response = client.models.generate_content(
                model=generation_model,
                contents=[prompt, image],
                config=types.GenerateContentConfig(
                    response_modalities=["TEXT", "IMAGE"],
                    seed=42,
                ),
            )

            for part in response.candidates[0].content.parts:
                if hasattr(part, "inline_data") and part.inline_data is not None:
                    image_b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
                    return image_b64, part.inline_data.mime_type, False, generation_model

            raise ValueError(
                f"No image returned by {generation_model}. "
                "Check that the model supports image output and your API key has access."
            )
        except APIError as exc:
            if is_transient_capacity_error(exc) and idx < len(models_to_try) - 1:
                continue
            raise exc
