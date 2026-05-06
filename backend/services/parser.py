import os
import io
import hashlib
from google import genai
from google.genai import types
from google.genai.errors import APIError
from PIL import Image

from models import FloorplanParsePayload, FloorplanParseResult, Room
from services.gemini_fallback import is_transient_capacity_error, parse_model_chain

PARSE_PROMPT = """
Analyze this architectural floor plan image.

Return a JSON object describing the layout:
{
  "is_floorplan": true or false — false if this is NOT an architectural floor plan,
  "rooms": [
    {
      "type": one of: bedroom | bathroom | kitchen | living_room | dining_room | study | balcony | laundry | garage | hallway | closet | storage | other,
      "label": exact label text visible in the plan, or your inferred name,
      "approx_area_sqm": estimated area as a number, or null if unclear,
      "fixtures": list of fixtures/appliances visible in this room WITH their wall or position — e.g. ["stove on south wall", "sink on east counter", "island in centre", "toilet against north wall", "bathtub on west wall"] — empty list if none are discernible,
      "floor_material": floor material explicitly labelled or hatched in this room — e.g. "timber", "ceramic tile", "polished concrete", "carpet" — null if not indicated in the plan
    }
  ],
  "has_outdoor_space": true or false,
  "summary": one sentence describing the overall layout,
  "consistency_key": stable lowercase key made from the room sequence, for example "2-bed-1-bath-kitchen-living",
  "hallucination_risks": short list of ambiguous items that the renderer must not invent
}

Rules:
- Include ONLY rooms and spaces actually visible in this floor plan — no more, no less
- If a room has no visible label, infer its type from furniture, fixtures, or position
- Each distinct room/space in the plan must appear exactly once
- Estimate approx_area_sqm from visual proportion relative to a typical apartment (null is fine)
- For fixtures: record only what is explicitly drawn in the plan symbol or icon; describe wall/side placement using compass direction (north/south/east/west) or relative position (left/right/centre/back/front) based on standard plan orientation; omit fixtures that are ambiguous or not drawn
- Do not infer luxury finishes, furniture brands, views, or decorations from the image
"""


def _mock_parse(image_bytes: bytes) -> FloorplanParseResult:
    """
    Local fallback for MVP demos without a Gemini key. It keeps the full stack testable
    while making it obvious that real semantic parsing requires the API.
    """
    digest = hashlib.sha256(image_bytes).hexdigest()[:8]
    rooms = [
        Room(type="living_room", label="Living / Dining", approx_area_sqm=None),
        Room(type="kitchen", label="Kitchen", approx_area_sqm=None),
        Room(type="bedroom", label="Bedroom", approx_area_sqm=None),
        Room(type="bathroom", label="Bathroom", approx_area_sqm=None),
    ]
    return FloorplanParseResult(
        is_floorplan=True,
        rooms=rooms,
        has_outdoor_space=False,
        summary=(
            "Mock parse: API key not configured, so the app is using a deterministic "
            f"sample layout for local MVP verification ({digest})."
        ),
        consistency_key="mock-living-kitchen-bedroom-bathroom",
        hallucination_risks=[
            "Room count is mocked; connect GEMINI_API_KEY for real floorplan parsing.",
        ],
        model_used="mock-local-parse",
    )


def parse_floorplan(image_bytes: bytes) -> FloorplanParseResult:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        return _mock_parse(image_bytes)

    image = Image.open(io.BytesIO(image_bytes))
    client = genai.Client(api_key=api_key)
    models_to_try = parse_model_chain()

    for idx, parse_model in enumerate(models_to_try):
        try:
            response = client.models.generate_content(
                model=parse_model,
                contents=[PARSE_PROMPT, image],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=FloorplanParsePayload,
                ),
            )
            payload = FloorplanParsePayload.model_validate_json(response.text)

            result = FloorplanParseResult(
                **payload.model_dump(),
                model_used=parse_model,
            )

            if not result.consistency_key:
                room_key = "-".join(room.type for room in result.rooms)
                result = result.model_copy(
                    update={"consistency_key": room_key or "no-rooms"}
                )

            return result
        except APIError as exc:
            if is_transient_capacity_error(exc) and idx < len(models_to_try) - 1:
                continue
            raise exc

    raise RuntimeError("No parse models configured.")
