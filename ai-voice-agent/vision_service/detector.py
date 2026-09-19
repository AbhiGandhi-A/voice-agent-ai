import io
import os
import time
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image
from transformers import pipeline

# Directory for caching local models
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

YUNET_MODEL_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"

# Emotion classification model (Apache 2.0 open-source model)
EMOTION_MODEL_NAME = "dima806/facial_emotions_image_detection"

# Valid emotion labels produced by the model:
# 'happy', 'sad', 'neutral', 'angry', 'surprise', 'fear', 'disgust'
CONFIDENCE_THRESHOLD = 0.35


class VisionDetector:
    _instance: Optional["VisionDetector"] = None

    def __init__(self):
        self.device = "cpu"
        self._ensure_yunet_downloaded()
        self.face_detector = cv2.FaceDetectorYN_create(
            model=YUNET_MODEL_PATH,
            config="",
            input_size=(320, 240),
            score_threshold=0.55,
            nms_threshold=0.3,
            top_k=5000,
        )
        print(f"[VISION SERVICE] Loading emotion model {EMOTION_MODEL_NAME} on {self.device}...")
        self.emotion_classifier = pipeline(
            "image-classification",
            model=EMOTION_MODEL_NAME,
            device=self.device,
        )
        print("[VISION SERVICE] Models loaded and ready.")

    @classmethod
    def get_instance(cls) -> "VisionDetector":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _ensure_yunet_downloaded(self) -> None:
        if not os.path.exists(YUNET_MODEL_PATH) or os.path.getsize(YUNET_MODEL_PATH) < 1000:
            print(f"[VISION SERVICE] Downloading YuNet face detection model from {YUNET_URL}...")
            urllib.request.urlretrieve(YUNET_URL, YUNET_MODEL_PATH)
            print("[VISION SERVICE] YuNet model downloaded successfully.")

    def analyze_image(self, image_bytes: bytes) -> Dict[str, Any]:
        start_time = time.time()

        # Decode image using OpenCV / Pillow
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(pil_image)
        h, w = img_np.shape[:2]

        # Convert RGB to BGR for OpenCV
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

        # Run face detection with YuNet
        self.face_detector.setInputSize((w, h))
        _, faces = self.face_detector.detect(img_bgr)

        face_count = 0 if faces is None else len(faces)
        landmarks_detected = False
        detected_expression = "none"
        confidence = 0.0
        all_expressions: Dict[str, float] = {}

        if face_count > 0 and faces is not None:
            # Find the largest face (by bounding box area)
            largest_face = None
            max_area = 0
            for face in faces:
                # face format: [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm, score]
                fx, fy, fw, fh = face[0:4]
                area = fw * fh
                if area > max_area:
                    max_area = area
                    largest_face = face

            if largest_face is not None:
                landmarks_detected = True
                fx, fy, fw, fh = int(largest_face[0]), int(largest_face[1]), int(largest_face[2]), int(largest_face[3])

                # Add 15% margin around the face for emotion context
                pad_w = int(fw * 0.15)
                pad_h = int(fh * 0.15)
                x1 = max(0, fx - pad_w)
                y1 = max(0, fy - pad_h)
                x2 = min(w, fx + fw + pad_w)
                y2 = min(h, fy + fh + pad_h)

                face_crop = pil_image.crop((x1, y1, x2, y2))
                if face_crop.size[0] > 10 and face_crop.size[1] > 10:
                    raw_emotions: List[Dict[str, Any]] = self.emotion_classifier(face_crop)
                    for item in raw_emotions:
                        all_expressions[item["label"].lower()] = round(float(item["score"]), 3)

                    if raw_emotions:
                        top_emotion = raw_emotions[0]
                        top_label = top_emotion["label"].lower()
                        top_score = float(top_emotion["score"])

                        if top_score >= CONFIDENCE_THRESHOLD:
                            detected_expression = top_label
                            confidence = round(top_score, 2)
                        else:
                            detected_expression = "uncertain"
                            confidence = round(top_score, 2)

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "faceDetected": face_count > 0,
            "faceCount": face_count,
            "expression": detected_expression,
            "confidence": confidence,
            "landmarksDetected": landmarks_detected,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "processingTimeMs": elapsed_ms,
            "allExpressions": all_expressions,
        }

