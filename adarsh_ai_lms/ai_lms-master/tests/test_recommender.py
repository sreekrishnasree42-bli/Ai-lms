import unittest
from pathlib import Path

from models.recommender import CourseRecommender


class CourseRecommenderTest(unittest.TestCase):
    def setUp(self):
        data_path = Path(__file__).resolve().parent.parent / "data" / "courses.csv"
        self.recommender = CourseRecommender(data_path)

    def test_recommends_python_courses(self):
        results = self.recommender.recommend("python", limit=3)
        titles = [course["title"] for course in results]

        self.assertIn("Python for Beginners", titles)

    def test_understands_related_web_topic(self):
        results = self.recommender.recommend("websites", limit=3)
        categories = {course["category"] for course in results}

        self.assertTrue({"Frontend", "Web Development"} & categories)

    def test_filters_by_difficulty(self):
        results = self.recommender.recommend("react", difficulty="beginner", limit=5)

        self.assertGreater(len(results), 0)
        self.assertTrue(all(course["difficulty"] == "beginner" for course in results))

    def test_infers_difficulty_from_natural_query(self):
        results = self.recommender.recommend("beginner react", limit=5)

        self.assertEqual(results[0]["title"], "React Basics")
        self.assertTrue(all(course["difficulty"] == "beginner" for course in results))

    def test_corrects_small_topic_typos(self):
        results = self.recommender.recommend("pyhton beginner", limit=3)

        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["title"], "Python for Beginners")

    def test_filter_only_query_returns_matching_courses(self):
        results = self.recommender.recommend("beginner", limit=5)

        self.assertGreater(len(results), 1)
        self.assertTrue(all(course["difficulty"] == "beginner" for course in results))

    def test_database_query_does_not_match_data_structures(self):
        results = self.recommender.recommend("database", limit=5)
        titles = [course["title"] for course in results]

        self.assertIn("SQL and Database Design", titles)
        self.assertNotIn("Data Structures and Algorithms", titles)

    def test_category_query_stays_in_category(self):
        results = self.recommender.recommend("design", limit=5)

        self.assertGreater(len(results), 0)
        self.assertTrue(all(course["category"] == "Design" for course in results))

    def test_understands_natural_web_goal(self):
        results = self.recommender.recommend("build websites", limit=4)
        categories = {course["category"] for course in results}

        self.assertTrue({"Frontend", "Web Development"} & categories)
        self.assertNotIn("Backend", categories)


if __name__ == "__main__":
    unittest.main()
