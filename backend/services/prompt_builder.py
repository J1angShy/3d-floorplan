from config.brand_config import BRAND_PRESETS
from models import FloorplanParseResult


def build_prompt(parse_result: FloorplanParseResult, brand_name: str) -> str:
    """
    Builds a fully deterministic generation prompt from structured parse data
    and a locked brand config. Same inputs always produce the same prompt.
    """
    brand = BRAND_PRESETS[brand_name]

    room_lines = "\n".join(
        f"  - {r.type.replace('_', ' ').title()}: \"{r.label}\""
        for r in parse_result.rooms
    )
    risk_lines = "\n".join(
        f"  - {risk}" for risk in parse_result.hallucination_risks
    ) or "  - None identified"

    outdoor_line = (
        "  - Outdoor: YES — balcony/terrace with hedges and planters"
        if parse_result.has_outdoor_space
        else "  - Outdoor: NO"
    )

    return f"""Transform this 2D architectural floor plan into a photorealistic 3D axonometric dollhouse render.

FLOOR PLAN ROOMS — reproduce exactly, do not add or remove any spaces:
{room_lines}
{outdoor_line}
Total spaces: {len(parse_result.rooms)}
Consistency key: {parse_result.consistency_key}

KNOWN AMBIGUITIES — do not invent details to fill these gaps:
{risk_lines}

RENDERING STYLE — mandatory, do not deviate from any of these:
- Camera / perspective (critical): elevated three-quarter corner view from above — NOT a flat orthographic top-down plan. Use a dollhouse axonometric angle (~35–45° elevation from horizontal) so outer walls read as vertical planes with visible thickness, furniture reads as 3D volumes with tops/sides visible, and interior depth is obvious. Absolutely forbid blueprint-style straight-down views.
- Cutaway: crop exterior walls at uniform mid-height (architectural section cut); open top, no ceiling slab
- Walls: {brand['walls']}
- Floors: {brand['floor']}
- Furniture: {brand['furniture_style']}
- Primary accent: {brand['accent_primary']}
- Secondary accent: {brand['accent_secondary']}
- Fixtures and frames: {brand['fixtures']}
- Lighting: {brand['lighting']}
- Greenery: {brand['greenery']}
- Background: pure black (#000000), no ground plane or shadow

HARD CONSTRAINTS:
- Preserve the spatial layout and room proportions from the input floor plan
- Use only the rooms listed in FLOOR PLAN ROOMS as the source of truth
- No text labels, dimension lines, or annotations in the output image
- Do not add windows, balconies, stairs, closets, fixtures, furniture, or decor unless supported by the input or the room type
- Photo-realistic render quality
- Exactly {len(parse_result.rooms)} rooms/spaces as listed above — hallucinating extra rooms is a failure"""
