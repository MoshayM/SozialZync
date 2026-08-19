"""
Minimal FastAPI server exposing Meta's MusicGen for local music generation.
POST /generate  { prompt: str, duration: int, output_format: str }
Returns audio/mpeg directly.

Install: pip install fastapi uvicorn audiocraft torch torchaudio
Run:     python musicgen-server.py
Or via Docker Compose: docker compose --profile music up -d
"""
import io
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="MusicGen API", version="1.0.0")

_model = None


def get_model():
    global _model
    if _model is None:
        from audiocraft.models import MusicGen
        # facebook/musicgen-small: ~300MB, fast. Use musicgen-medium for better quality.
        _model = MusicGen.get_pretrained("facebook/musicgen-small")
    return _model


class GenerateRequest(BaseModel):
    prompt: str
    duration: int = 10
    output_format: str = "mp3"


@app.post("/generate")
def generate(req: GenerateRequest):
    try:
        model = get_model()
        model.set_generation_params(duration=min(req.duration, 30))
        wav = model.generate([req.prompt])
        import torchaudio
        buf = io.BytesIO()
        torchaudio.save(buf, wav[0].cpu(), model.sample_rate, format="mp3")
        buf.seek(0)
        return Response(content=buf.read(), media_type="audio/mpeg")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/health")
def health():
    return {"status": "ok", "model": "facebook/musicgen-small"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7861)
