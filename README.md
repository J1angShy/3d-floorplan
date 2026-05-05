# 2D to 3D Floorplan MVP

Full-stack MVP for turning a 2D floorplan into a branded 3D render flow.

The current focus is not raw rendering quality. It is the orchestration layer around Nano Banana:

- Brand fidelity: generation prompts are built server-side from locked brand presets.
- Consistency: the image is parsed into structured room JSON before rendering.
- Hallucination reduction: parsed rooms and ambiguity risks become hard prompt constraints.

## Run Locally

Backend:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Environment

Copy `.env.example` to `.env` at the repo root:

```bash
cp .env.example .env
```

Without `GEMINI_API_KEY`, the app runs in mock mode so the full UI can still be verified locally. Add a real key to enable Gemini parsing and Nano Banana image generation.

Model defaults:

- `GEMINI_PARSE_MODEL=gemini-2.5-flash`
- `GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview` (Nano Banana 2)

## MVP Flow

1. Upload a 2D floorplan image.
2. Parse the image into structured rooms, a consistency key, and hallucination risks.
3. Generate a 3D render using the parsed data plus locked brand constraints.

