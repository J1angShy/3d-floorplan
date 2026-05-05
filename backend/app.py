import os
import time
import uuid
from pathlib import Path
from fastapi import BackgroundTasks, FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google.genai.errors import APIError
from pydantic import ValidationError

from models import (
    FloorplanParseResult,
    GenerateJobStartResponse,
    GenerateJobStatusResponse,
    GenerateResponse,
    ParseJobStartResponse,
    ParseJobStatusResponse,
    PromptBuildRequest,
    PromptBuildResponse,
)
from services.guardrails import validate_upload
from services.parser import parse_floorplan
from services.prompt_builder import build_prompt
from services.generator import generate_3d_render
from config.brand_config import BRAND_PRESETS, DEFAULT_BRAND

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")
load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI(title="3D Floorplan API")
PARSE_JOBS: dict[str, dict] = {}
GENERATE_JOBS: dict[str, dict] = {}
MAX_PROMPT_CHARS = 50_000

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "brands": list(BRAND_PRESETS.keys()),
    }


@app.get("/api/brands")
def brands():
    return {"default": DEFAULT_BRAND, "presets": BRAND_PRESETS}


def _set_job(
    job_id: str,
    *,
    status: str,
    progress: int,
    stage: str,
    message: str,
    result: GenerateResponse | None = None,
    error: str | None = None,
) -> None:
    job = GENERATE_JOBS[job_id]
    job.update(
        {
            "status": status,
            "progress": progress,
            "stage": stage,
            "message": message,
            "updated_at": time.time(),
            "result": result,
            "error": error,
        }
    )


def _set_parse_job(
    job_id: str,
    *,
    status: str,
    progress: int,
    stage: str,
    message: str,
    result: FloorplanParseResult | None = None,
    error: str | None = None,
) -> None:
    job = PARSE_JOBS[job_id]
    job.update(
        {
            "status": status,
            "progress": progress,
            "stage": stage,
            "message": message,
            "updated_at": time.time(),
            "result": result,
            "error": error,
        }
    )


def _run_parse_job(job_id: str, image_bytes: bytes) -> None:
    try:
        _set_parse_job(
            job_id,
            status="running",
            progress=20,
            stage="preparing_image",
            message="Preparing image for Gemini Vision analysis.",
        )

        _set_parse_job(
            job_id,
            status="running",
            progress=45,
            stage="calling_gemini_vision",
            message="Calling Gemini Vision to extract rooms, labels, and ambiguities.",
        )
        result = parse_floorplan(image_bytes)

        _set_parse_job(
            job_id,
            status="running",
            progress=80,
            stage="checking_guardrails",
            message="Checking floorplan validity and hallucination guardrails.",
        )
        if not result.is_floorplan:
            raise ValueError("Image does not appear to be an architectural floor plan.")

        _set_parse_job(
            job_id,
            status="completed",
            progress=100,
            stage="completed",
            message=f"Parsed {len(result.rooms)} spaces with model `{result.model_used}`.",
            result=result,
        )
    except (APIError, ValidationError, ValueError) as exc:
        _set_parse_job(
            job_id,
            status="failed",
            progress=100,
            stage="failed",
            message="Floorplan analysis failed.",
            error=str(exc),
        )
    except Exception as exc:
        _set_parse_job(
            job_id,
            status="failed",
            progress=100,
            stage="failed",
            message="Unexpected floorplan analysis failure.",
            error=str(exc),
        )


def _run_generate_job(
    job_id: str,
    image_bytes: bytes,
    parse_result_json: str,
    brand_preset: str,
    prompt_override: str | None,
) -> None:
    try:
        _set_job(
            job_id,
            status="running",
            progress=15,
            stage="validating",
            message="Validating parsed floorplan and selected brand preset.",
        )
        parsed = FloorplanParseResult.model_validate_json(parse_result_json)

        trimmed = (prompt_override or "").strip()
        if trimmed:
            if len(trimmed) > MAX_PROMPT_CHARS:
                raise ValueError(f"Prompt exceeds maximum length ({MAX_PROMPT_CHARS} characters).")
            prompt = trimmed
            _set_job(
                job_id,
                status="running",
                progress=30,
                stage="client_prompt",
                message="Using your edited prompt for image generation.",
            )
        else:
            _set_job(
                job_id,
                status="running",
                progress=30,
                stage="building_prompt",
                message="Building locked brand prompt from parsed rooms and guardrails.",
            )
            prompt = build_prompt(parsed, brand_preset)

        _set_job(
            job_id,
            status="running",
            progress=55,
            stage="calling_nano_banana",
            message="Calling Nano Banana 2. This can take 30-90 seconds for image generation.",
        )
        image_b64, mime_type, is_mock, image_model_used = generate_3d_render(image_bytes, prompt)

        result = GenerateResponse(
            image_base64=image_b64,
            mime_type=mime_type,
            prompt_used=prompt,
            room_count=len(parsed.rooms),
            is_mock=is_mock,
            image_model_used=image_model_used,
        )
        _set_job(
            job_id,
            status="completed",
            progress=100,
            stage="completed",
            message=f"3D render is ready (image model: `{result.image_model_used}`).",
            result=result,
        )
    except (APIError, ValidationError, ValueError) as exc:
        _set_job(
            job_id,
            status="failed",
            progress=100,
            stage="failed",
            message="Generation failed.",
            error=str(exc),
        )
    except Exception as exc:
        _set_job(
            job_id,
            status="failed",
            progress=100,
            stage="failed",
            message="Unexpected generation failure.",
            error=str(exc),
        )


@app.post("/api/prompt", response_model=PromptBuildResponse)
def preview_prompt(body: PromptBuildRequest):
    if body.brand_preset not in BRAND_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unknown brand preset: {body.brand_preset}")
    return PromptBuildResponse(prompt=build_prompt(body.parse_result, body.brand_preset))


@app.post("/api/parse", response_model=FloorplanParseResult)
async def parse(image: UploadFile = File(...)):
    image_bytes = await image.read()

    error = validate_upload(image_bytes, image.content_type or "")
    if error:
        raise HTTPException(status_code=400, detail=error)

    try:
        result = parse_floorplan(image_bytes)
    except APIError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini parse request failed: {exc}",
        ) from exc
    except ValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini parse response did not match the expected schema: {exc}",
        ) from exc

    if not result.is_floorplan:
        raise HTTPException(
            status_code=422,
            detail="Image does not appear to be an architectural floor plan.",
        )

    return result


@app.post("/api/parse/jobs", response_model=ParseJobStartResponse)
async def start_parse_job(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
):
    image_bytes = await image.read()

    error = validate_upload(image_bytes, image.content_type or "")
    if error:
        raise HTTPException(status_code=400, detail=error)

    job_id = uuid.uuid4().hex
    now = time.time()
    PARSE_JOBS[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "progress": 5,
        "stage": "queued",
        "message": "Floorplan analysis job queued.",
        "created_at": now,
        "updated_at": now,
        "result": None,
        "error": None,
    }

    background_tasks.add_task(_run_parse_job, job_id, image_bytes)

    return ParseJobStartResponse(
        job_id=job_id,
        status="queued",
        message="Floorplan analysis job queued.",
    )


@app.get("/api/parse/jobs/{job_id}", response_model=ParseJobStatusResponse)
def get_parse_job(job_id: str):
    job = PARSE_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Parse job not found.")

    return ParseJobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        stage=job["stage"],
        message=job["message"],
        elapsed_seconds=round(time.time() - job["created_at"], 1),
        result=job["result"],
        error=job["error"],
    )


@app.post("/api/generate", response_model=GenerateResponse)
async def generate(
    image: UploadFile = File(...),
    parse_result: str = Form(...),
    brand_preset: str = Form(default="modern"),
    prompt_override: str = Form(default=""),
):
    image_bytes = await image.read()

    error = validate_upload(image_bytes, image.content_type or "")
    if error:
        raise HTTPException(status_code=400, detail=error)

    if brand_preset not in BRAND_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unknown brand preset: {brand_preset}")

    try:
        parsed = FloorplanParseResult.model_validate_json(parse_result)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Invalid parse_result payload.") from exc

    trimmed = prompt_override.strip()
    if trimmed:
        if len(trimmed) > MAX_PROMPT_CHARS:
            raise HTTPException(
                status_code=400,
                detail=f"Prompt exceeds maximum length ({MAX_PROMPT_CHARS} characters).",
            )
        prompt = trimmed
    else:
        prompt = build_prompt(parsed, brand_preset)
    try:
        image_b64, mime_type, is_mock, image_model_used = generate_3d_render(image_bytes, prompt)
    except APIError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini image generation request failed: {exc}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return GenerateResponse(
        image_base64=image_b64,
        mime_type=mime_type,
        prompt_used=prompt,
        room_count=len(parsed.rooms),
        is_mock=is_mock,
        image_model_used=image_model_used,
    )


@app.post("/api/generate/jobs", response_model=GenerateJobStartResponse)
async def start_generate_job(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    parse_result: str = Form(...),
    brand_preset: str = Form(default="modern"),
    prompt_override: str = Form(default=""),
):
    image_bytes = await image.read()

    error = validate_upload(image_bytes, image.content_type or "")
    if error:
        raise HTTPException(status_code=400, detail=error)

    if brand_preset not in BRAND_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unknown brand preset: {brand_preset}")

    try:
        FloorplanParseResult.model_validate_json(parse_result)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Invalid parse_result payload.") from exc

    job_id = uuid.uuid4().hex
    now = time.time()
    GENERATE_JOBS[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "progress": 5,
        "stage": "queued",
        "message": "Generation job queued.",
        "created_at": now,
        "updated_at": now,
        "result": None,
        "error": None,
    }

    background_tasks.add_task(
        _run_generate_job,
        job_id,
        image_bytes,
        parse_result,
        brand_preset,
        prompt_override or None,
    )

    return GenerateJobStartResponse(
        job_id=job_id,
        status="queued",
        message="Generation job queued.",
    )


@app.get("/api/generate/jobs/{job_id}", response_model=GenerateJobStatusResponse)
def get_generate_job(job_id: str):
    job = GENERATE_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Generation job not found.")

    return GenerateJobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        stage=job["stage"],
        message=job["message"],
        elapsed_seconds=round(time.time() - job["created_at"], 1),
        result=job["result"],
        error=job["error"],
    )
