from pydantic import BaseModel, Field
from typing import Optional, Literal


class Room(BaseModel):
    type: Literal[
        "bedroom", "bathroom", "kitchen", "living_room", "dining_room",
        "study", "balcony", "laundry", "garage", "hallway", "closet", "storage", "other"
    ]
    label: str
    approx_area_sqm: Optional[float] = None
    fixtures: list[str] = Field(
        default_factory=list,
        description="Fixtures and appliances visible in this room, each with their wall/position. E.g. ['stove on south wall', 'sink on east counter', 'island in centre'].",
    )
    floor_material: Optional[str] = Field(
        default=None,
        description="Floor material explicitly labelled in the plan for this room, e.g. 'timber', 'ceramic tile', 'concrete'. Null if not specified.",
    )


class FloorplanParsePayload(BaseModel):
    """Structured output returned by Gemini Vision — used as response_schema only."""

    is_floorplan: bool
    rooms: list[Room]
    has_outdoor_space: bool
    summary: str
    consistency_key: str = Field(
        default="",
        description="Stable fingerprint derived from parsed rooms for deterministic prompting.",
    )
    hallucination_risks: list[str] = Field(
        default_factory=list,
        description="Visible ambiguities that generation must not invent around.",
    )


class FloorplanParseResult(FloorplanParsePayload):
    """API payload including the model id that actually produced the parse (server-set)."""

    model_used: str = Field(
        default="",
        description="Gemini model id used for this parse (after fallback resolution).",
    )


class GenerateResponse(BaseModel):
    image_base64: str
    mime_type: str
    prompt_used: str
    room_count: int
    is_mock: bool = False
    image_model_used: str = Field(
        default="",
        description="Image model id used for this render (after fallback resolution).",
    )


class ParseJobStartResponse(BaseModel):
    job_id: str
    status: Literal["queued"]
    message: str


class ParseJobStatusResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "failed"]
    progress: int
    stage: str
    message: str
    elapsed_seconds: float
    result: Optional[FloorplanParseResult] = None
    error: Optional[str] = None


class GenerateJobStartResponse(BaseModel):
    job_id: str
    status: Literal["queued"]
    message: str


class GenerateJobStatusResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "failed"]
    progress: int
    stage: str
    message: str
    elapsed_seconds: float
    result: Optional[GenerateResponse] = None
    error: Optional[str] = None


class PromptBuildRequest(BaseModel):
    parse_result: FloorplanParseResult
    brand_preset: str = "modern"


class PromptBuildResponse(BaseModel):
    prompt: str
