import base64
import os
import sys
import time
from typing import Any, Dict, Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Add current dir to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from detector import VisionDetector, EMOTION_MODEL_NAME

START_TIME = time.time()

app = FastAPI(
    title="Local Python Vision & Face Analysis Service",
    description="Real-time CPU facial emotion and landmark analysis service for AI Voice Agent",
    version="1.0.0",
)

# Bind CORS to local origins only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class AnalyzeFaceRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded JPEG or PNG image frame")


class HealthResponse(BaseModel):
    status: str
    provider: str
    model: str
    device: str
    uptimeSeconds: int


@app.on_event("startup")
async def startup_event():
    print("[VISION SERVICE] Initializing models at startup...")
    VisionDetector.get_instance()
    print("[VISION SERVICE] Startup complete. Listening on 127.0.0.1:8000")


@app.get("/health", response_model=HealthResponse)
async def health():
    try:
        detector = VisionDetector.get_instance()
        if not detector.face_detector or not detector.emotion_classifier:
            raise HTTPException(status_code=503, detail="Models not loaded")
        return HealthResponse(
            status="ok",
            provider="local-python",
            model=f"{EMOTION_MODEL_NAME} + yunet",
            device="cpu",
            uptimeSeconds=int(time.time() - START_TIME),
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {str(e)}")


@app.post("/analyze-face")
async def analyze_face(request: Request, payload: Optional[AnalyzeFaceRequest] = None):
    image_bytes: Optional[bytes] = None

    # Check content type for JSON vs Multipart
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        try:
            body = await request.json()
            image_b64 = body.get("image", "")
            if not image_b64:
                raise HTTPException(status_code=400, detail="Missing 'image' field in JSON request.")

            # Strip data URL prefix if present (e.g. data:image/jpeg;base64,...)
            if "," in image_b64:
                image_b64 = image_b64.split(",", 1)[1]

            image_bytes = base64.b64decode(image_b64)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {str(e)}")

    elif "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file") or form.get("image")
        if file and hasattr(file, "read"):
            image_bytes = await file.read()
        else:
            raise HTTPException(status_code=400, detail="No file or image uploaded in multipart form.")
    else:
        # Check raw body bytes
        raw_body = await request.body()
        if len(raw_body) > 0:
            image_bytes = raw_body

    if not image_bytes or len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="No image bytes provided.")

    # Max size safety check: 5MB
    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image frame exceeds 5MB maximum limit.")

    try:
        detector = VisionDetector.get_instance()
        result = detector.analyze_image(image_bytes)
        return result
    except Exception as e:
        print(f"[VISION SERVICE] Error analyzing frame: {e}")
        raise HTTPException(status_code=500, detail=f"Face analysis failed: {str(e)}")


def run():
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        access_log=False,
    )


if __name__ == "__main__":
    run()

