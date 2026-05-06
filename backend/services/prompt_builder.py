from config.brand_config import BRAND_PRESETS
from models import FloorplanParseResult


def build_prompt(parse_result: FloorplanParseResult, brand_name: str) -> str:
    """
    Builds a fully deterministic generation prompt from structured parse data
    and a locked brand config. Same inputs always produce the same prompt.
    """
    brand = BRAND_PRESETS[brand_name]

    def _room_line(r) -> str:
        base = f"  - {r.type.replace('_', ' ').title()}: \"{r.label}\""
        extras = []
        if r.fixtures:
            extras.append("fixtures: " + "; ".join(r.fixtures))
        if r.floor_material:
            extras.append(f"floor: {r.floor_material}")
        if extras:
            return f"{base} [{', '.join(extras)}]"
        return base

    room_lines = "\n".join(_room_line(r) for r in parse_result.rooms)
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
- Floors: {brand['floor']} — default; where a room's [floor: ...] tag specifies a different material, use that material for that room only
- Furniture: {brand['furniture_style']}
- Primary accent: {brand['accent_primary']}
- Secondary accent: {brand['accent_secondary']}
- Fixtures and frames: {brand['fixtures']}
- Lighting: {brand['lighting']}
- Greenery: {brand['greenery']}
- Background: pure black (#000000), no ground plane or shadow

ROOM-TYPE RENDERING RULES — fixed specifications; apply identically every time:
- Closet / Walk-in Robe / Wardrobe: open top (no ceiling slab, matching all other rooms); always render exactly one horizontal hanging rail spanning the full width at ~1.7 m height; walls and floor identical to the rest of the unit; no exceptions
- All fixture and appliance positions: reproduce exactly as recorded in the [fixtures] tags above — do not relocate, substitute, or add any fixture not listed there
- Storage / Laundry / Utility: all cabinet and cupboard doors rendered in the fully closed position; no doors shown ajar or open
- All rooms: include only fixtures and furniture listed in [fixtures] tags or standard for that room type; do not add pendant lights, bonus appliances, or decorative elements not present in the input

HARD CONSTRAINTS:
- NO TEXT WHATSOEVER: zero letters, numbers, room names, labels, dimensions, symbols, captions, or annotations anywhere in the image — not even a single character; if any text would appear, the render is a failure
- Preserve the spatial layout and room proportions from the input floor plan
- Use only the rooms listed in FLOOR PLAN ROOMS as the source of truth
- Do not add windows, balconies, stairs, closets, fixtures, furniture, or decor unless supported by the input or the room type
- Photo-realistic render quality
- Exactly {len(parse_result.rooms)} rooms/spaces as listed above — hallucinating extra rooms is a failure"""
