from typing import TypedDict


class BrandPreset(TypedDict):
    name: str
    walls: str
    floor: str
    furniture_style: str
    accent_primary: str
    accent_secondary: str
    fixtures: str
    lighting: str
    greenery: str


BRAND_PRESETS: dict[str, BrandPreset] = {
    "modern": {
        "name": "Default",
        "walls": "pure white matte plaster (#FFFFFF)",
        "floor": "light oak hardwood with subtle grain texture",
        "furniture_style": "contemporary Scandinavian — clean lines, linen and neutral upholstery",
        "accent_primary": "deep burgundy/mauve (#7B3F6E) on bedding, chair cushions, table accessories",
        "accent_secondary": "soft lavender (#E8D5F0) on throw pillows and framed artwork",
        "fixtures": "matte black (#1A1A1A) door frames, window frames, pendant lights",
        "lighting": "bright natural daylight from top-left, soft directional shadows",
        "greenery": "tropical plants (monstera, fiddle-leaf fig, snake plant) at balconies and room corners",
    },
}

DEFAULT_BRAND = "modern"
