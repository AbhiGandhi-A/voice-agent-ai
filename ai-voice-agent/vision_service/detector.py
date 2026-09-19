import io
import os
import time
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image
from transformers import pipeline

from mp_palmdet import MPPalmDet
from mp_handpose import MPHandPose

# Directory for caching local models
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

YUNET_MODEL_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"

PALM_MODEL_PATH = os.path.join(MODELS_DIR, "palm_detection_mediapipe_2023feb.onnx")
PALM_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/palm_detection_mediapipe/palm_detection_mediapipe_2023feb.onnx"

HANDPOSE_MODEL_PATH = os.path.join(MODELS_DIR, "handpose_estimation_mediapipe_2023feb.onnx")
HANDPOSE_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/handpose_estimation_mediapipe/handpose_estimation_mediapipe_2023feb.onnx"

# Emotion classification model (Apache 2.0 open-source model)
EMOTION_MODEL_NAME = "dima806/facial_emotions_image_detection"

# Valid emotion labels produced by the model:
# 'happy', 'sad', 'neutral', 'angry', 'surprise', 'fear', 'disgust'
CONFIDENCE_THRESHOLD = 0.35


def count_fingers_from_landmarks(landmarks: np.ndarray) -> Tuple[int, Dict[str, bool]]:
    """
    Computes finger extension states and total count using rotation-invariant joint distances.
    Landmarks array shape: (21, 3) or (21, 2)
    0: wrist
    Thumb: 1(CMC), 2(MCP), 3(IP), 4(TIP)
    Index: 5(MCP), 6(PIP), 7(DIP), 8(TIP)
    Middle: 9(MCP), 10(PIP), 11(DIP), 12(TIP)
    Ring: 13(MCP), 14(PIP), 15(DIP), 16(TIP)
    Pinky: 17(MCP), 18(PIP), 19(DIP), 20(TIP)
    """
    def dist(p1: int, p2: int) -> float:
        return float(np.linalg.norm(landmarks[p1][:2] - landmarks[p2][:2]))

    wrist = 0
    pinky_mcp = 17

    finger_joints = [
        ("index", 5, 6, 7, 8),
        ("middle", 9, 10, 11, 12),
        ("ring", 13, 14, 15, 16),
        ("pinky", 17, 18, 19, 20),
    ]

    fingers_state: Dict[str, bool] = {}
    total_open = 0

    for name, mcp, pip, dip, tip in finger_joints:
        d_wrist_tip = dist(wrist, tip)
        d_wrist_pip = dist(wrist, pip)
        d_wrist_dip = dist(wrist, dip)
        d_mcp_tip = dist(mcp, tip)
        d_mcp_pip = dist(mcp, pip)

        is_open = (
            (d_wrist_tip > d_wrist_pip * 1.05)
            and (d_wrist_tip > d_wrist_dip)
            and (d_mcp_tip > d_mcp_pip * 1.1)
        )
        fingers_state[name] = bool(is_open)
        if is_open:
            total_open += 1

    # Thumb extension check
    d_pinky_tip = dist(pinky_mcp, 4)
    d_pinky_ip = dist(pinky_mcp, 3)
    d_wrist_tip = dist(wrist, 4)
    d_wrist_mcp = dist(wrist, 2)
    thumb_open = (d_pinky_tip > d_pinky_ip * 1.15) and (d_wrist_tip > d_wrist_mcp * 1.1)
    fingers_state["thumb"] = bool(thumb_open)
    if thumb_open:
        total_open += 1

    return total_open, fingers_state


class VisionDetector:
    _instance: Optional["VisionDetector"] = None

    def __init__(self):
        self.device = "cpu"
        self._ensure_yunet_downloaded()
        self._ensure_models_downloaded()

        # 1. Face Detector (YuNet)
        self.face_detector = cv2.FaceDetectorYN_create(
            model=YUNET_MODEL_PATH,
            config="",
            input_size=(320, 240),
            score_threshold=0.55,
            nms_threshold=0.3,
            top_k=5000,
        )

        # 2. Facial Emotion Classifier (ViT)
        print(f"[VISION SERVICE] Loading emotion model {EMOTION_MODEL_NAME} on {self.device}...")
        try:
            self.emotion_classifier = pipeline(
                "image-classification",
                model=EMOTION_MODEL_NAME,
                device=self.device,
                model_kwargs={"local_files_only": True},
            )
        except Exception:
            self.emotion_classifier = pipeline(
                "image-classification",
                model=EMOTION_MODEL_NAME,
                device=self.device,
            )
        print("[VISION SERVICE] Models loaded and ready.")

        # 3. MediaPipe Palm Detector & HandPose Estimator
        print("[VISION SERVICE] Initializing Palm Detector & Hand Landmark Estimator...")
        self.palm_detector = MPPalmDet(
            modelPath=PALM_MODEL_PATH,
            scoreThreshold=0.5,
            nmsThreshold=0.3,
        )
        self.hand_estimator = MPHandPose(
            modelPath=HANDPOSE_MODEL_PATH,
            confThreshold=0.5,
        )

        print("[VISION SERVICE] All vision models (Face, Emotion, Hand Landmark) loaded and ready.")

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
    def _ensure_models_downloaded(self) -> None:
        models = [
            (YUNET_MODEL_PATH, YUNET_URL, "YuNet face detection"),
            (PALM_MODEL_PATH, PALM_URL, "MediaPipe palm detection"),
            (HANDPOSE_MODEL_PATH, HANDPOSE_URL, "MediaPipe handpose estimation"),
        ]
        for path, url, name in models:
            if not os.path.exists(path) or os.path.getsize(path) < 1000:
                print(f"[VISION SERVICE] Downloading {name} model from {url}...")
                urllib.request.urlretrieve(url, path)
                print(f"[VISION SERVICE] {name} model downloaded successfully.")

    def analyze_image(self, image_bytes: bytes) -> Dict[str, Any]:
        start_time = time.time()

        # Decode image using OpenCV / Pillow
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(pil_image)
        h, w = img_np.shape[:2]

        # Convert RGB to BGR for OpenCV
        img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

        # Run face detection with YuNet
        # ─── 1. Face & Facial Emotion Analysis ─────────────────────────────
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

        # ─── 2. Hand & Finger Landmark Detection ───────────────────────────
        palms = self.palm_detector.infer(img_bgr)
        hand_detected = False
        hand_count = 0
        total_finger_count = 0
        primary_fingers = {"thumb": False, "index": False, "middle": False, "ring": False, "pinky": False}
        hands_detail: List[Dict[str, Any]] = []
        finger_confidence = 0.0

        if palms is not None and len(palms) > 0:
            # Sort detected palms by score descending, support up to 2 hands
            sorted_palms = sorted(palms, key=lambda p: float(p[-1]), reverse=True)[:2]
            conf_sum = 0.0

            for idx, palm in enumerate(sorted_palms):
                hand_res = self.hand_estimator.infer(img_bgr, palm)
                if hand_res is not None:
                    landmarks = None
                    conf_val = 0.0
                    if isinstance(hand_res, np.ndarray) and len(hand_res) >= 132:
                        landmarks = hand_res[4:67].reshape(21, 3)
                        conf_val = round(float(hand_res[131]), 2)
                    elif isinstance(hand_res, (tuple, list)) and len(hand_res) == 3:
                        _, lm, cf = hand_res
                        landmarks = lm
                        conf_val = round(float(cf), 2)

                    if landmarks is not None and len(landmarks) == 21:
                        f_count, f_states = count_fingers_from_landmarks(landmarks)
                        hand_detected = True
                        hand_count += 1
                        total_finger_count += f_count
                        conf_sum += conf_val
                        hands_detail.append({
                            "handIndex": idx + 1,
                            "fingerCount": f_count,
                            "fingers": f_states,
                            "confidence": conf_val,
                        })
                        if idx == 0:
                            primary_fingers = f_states

            if hand_count > 0:
                finger_confidence = round(conf_sum / hand_count, 2)

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            # Face fields
            "faceDetected": face_count > 0,
            "faceCount": face_count,
            "expression": detected_expression,
            "confidence": confidence,
            "landmarksDetected": landmarks_detected,
            "allExpressions": all_expressions,

            # Hand & Finger fields
            "handDetected": hand_detected,
            "handCount": hand_count,
            "fingerCount": total_finger_count,
            "fingers": primary_fingers,
            "hands": hands_detail,
            "fingerConfidence": finger_confidence,

            # General metadata
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "processingTimeMs": elapsed_ms,
            "allExpressions": all_expressions,
        }

