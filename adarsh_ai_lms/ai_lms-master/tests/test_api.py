import unittest

from fastapi.testclient import TestClient

from api.main import app


class RecommendationApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_recommend_endpoint_returns_json(self):
        response = self.client.get("/recommend", params={"query": "python", "limit": 2})
        data = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["query"], "python")
        self.assertEqual(data["count"], 2)
        self.assertIn("recommendations", data)
        self.assertEqual(data["recommendations"][0]["title"], "Python for Beginners")

    def test_post_recommend_endpoint_returns_json(self):
        response = self.client.post("/recommend", json={"query": "react", "limit": 1})
        data = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["query"], "react")
        self.assertEqual(data["count"], 1)
        self.assertIn("recommendations", data)


if __name__ == "__main__":
    unittest.main()
