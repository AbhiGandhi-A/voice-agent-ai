import base64
import io
import unittest
from PIL import Image, ImageDraw
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from main import app
from detector import VisionDetector
from detector import VisionDetector, count_fingers_from_landmarks


class TestVisionService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.detector = VisionDetector.get_instance()

    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["provider"], "local-python")
        self.assertEqual(data["device"], "cpu")
        self.assertIn("yunet", data["model"])

    def test_analyze_no_face_blank_image(self):
        # Create a blank black image with no face
        img = Image.new("RGB", (320, 240), color=(0, 0, 0))
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG")
        raw_bytes = buffer.getvalue()
        b64_str = base64.b64encode(raw_bytes).decode("utf-8")

        response = self.client.post("/analyze-face", json={"image": f"data:image/jpeg;base64,{b64_str}"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["faceDetected"])
        self.assertEqual(data["faceCount"], 0)
        self.assertEqual(data["expression"], "none")
        self.assertEqual(data["confidence"], 0.0)
        self.assertFalse(data["landmarksDetected"])
        self.assertFalse(data["handDetected"])
        self.assertEqual(data["handCount"], 0)
        self.assertEqual(data["fingerCount"], 0)
        self.assertIn("fingers", data)
        self.assertIn("hands", data)
        self.assertIn("fingerConfidence", data)
        self.assertIn("processingTimeMs", data)

    def test_analyze_invalid_payload(self):
        response = self.client.post("/analyze-face", json={"image": ""})
        self.assertEqual(response.status_code, 400)

    def test_finger_counting_geometry(self):
        # 21 points: 0 is wrist
        pts = np.zeros((21, 3))
        pts[0] = [100, 200, 0]  # wrist

        # Thumb
        pts[1] = [80, 180, 0]
        pts[2] = [60, 160, 0]
        pts[3] = [40, 140, 0]
        pts[4] = [20, 120, 0]  # extended thumb tip

        # Index
        pts[5] = [80, 140, 0]
        pts[6] = [80, 100, 0]
        pts[7] = [80, 60, 0]
        pts[8] = [80, 20, 0]  # extended index tip

        # Middle
        pts[9] = [100, 140, 0]
        pts[10] = [100, 90, 0]
        pts[11] = [100, 50, 0]
        pts[12] = [100, 10, 0]  # extended middle tip

        # Ring
        pts[13] = [120, 140, 0]
        pts[14] = [120, 100, 0]
        pts[15] = [120, 60, 0]
        pts[16] = [120, 20, 0]  # extended ring tip

        # Pinky
        pts[17] = [140, 150, 0]
        pts[18] = [140, 120, 0]
        pts[19] = [140, 90, 0]
        pts[20] = [140, 60, 0]  # extended pinky tip

        # Test 5 fingers (Open hand)
        count_5, states_5 = count_fingers_from_landmarks(pts)
        self.assertEqual(count_5, 5)
        self.assertTrue(states_5["thumb"])
        self.assertTrue(states_5["index"])
        self.assertTrue(states_5["middle"])
        self.assertTrue(states_5["ring"])
        self.assertTrue(states_5["pinky"])

        # Test 4 fingers (Fold thumb)
        pts[4] = [70, 170, 0]  # Fold thumb tip inward
        count_4, states_4 = count_fingers_from_landmarks(pts)
        self.assertEqual(count_4, 4)
        self.assertFalse(states_4["thumb"])
        self.assertTrue(states_4["index"])

        # Test 3 fingers (Fold thumb and pinky)
        pts[20] = [140, 140, 0]  # Fold pinky tip down
        count_3, states_3 = count_fingers_from_landmarks(pts)
        self.assertEqual(count_3, 3)
        self.assertFalse(states_3["thumb"])
        self.assertFalse(states_3["pinky"])
        self.assertTrue(states_3["index"])
        self.assertTrue(states_3["middle"])
        self.assertTrue(states_3["ring"])

        # Test 2 fingers (Victory / Peace sign: Index + Middle)
        pts[16] = [120, 130, 0]  # Fold ring tip down
        count_2, states_2 = count_fingers_from_landmarks(pts)
        self.assertEqual(count_2, 2)
        self.assertTrue(states_2["index"])
        self.assertTrue(states_2["middle"])
        self.assertFalse(states_2["ring"])

        # Test 1 finger (Index only)
        pts[12] = [100, 130, 0]  # Fold middle tip down
        count_1, states_1 = count_fingers_from_landmarks(pts)
        self.assertEqual(count_1, 1)
        self.assertTrue(states_1["index"])
        self.assertFalse(states_1["middle"])

        # Test 0 fingers (Fist: all folded)
        pts[8] = [80, 130, 0]  # Fold index tip down
        count_0, states_0 = count_fingers_from_landmarks(pts)
        self.assertEqual(count_0, 0)
        self.assertFalse(states_0["index"])


if __name__ == "__main__":
    unittest.main()

