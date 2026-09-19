import base64
import io
import unittest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from main import app
from detector import VisionDetector


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
        self.assertIn("processingTimeMs", data)

    def test_analyze_invalid_payload(self):
        response = self.client.post("/analyze-face", json={"image": ""})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()

