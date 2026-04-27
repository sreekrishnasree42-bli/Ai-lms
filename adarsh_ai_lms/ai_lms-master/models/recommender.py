from difflib import get_close_matches
from pathlib import Path
import re

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


DEFAULT_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "courses.csv"
SEARCH_COLUMNS = ["title", "description", "category", "tags", "difficulty", "language"]
TEXT_COLUMNS = ["title", "description", "category", "tags"]

DIFFICULTIES = {"beginner", "intermediate", "advanced"}
QUERY_SYNONYMS = {
    "website": "web frontend react mern",
    "websites": "web frontend react mern",
    "web": "web frontend react mern",
    "fullstack": "full stack mern",
    "full-stack": "full stack mern",
    "ml": "machine learning ai",
    "ai": "ai machine learning deep learning",
    "db": "database sql",
}


class CourseRecommender:
    def __init__(self, data_path=DEFAULT_DATA_PATH):
        self.data_path = Path(data_path)
        self.df = pd.read_csv(self.data_path).fillna("")
        self.courses = self.df.to_dict(orient="records")
        self._vocabulary = self._build_vocabulary()
        self._content = self.df[SEARCH_COLUMNS].agg(" ".join, axis=1).str.lower().tolist()
        self._vectorizer = TfidfVectorizer(ngram_range=(1, 2), token_pattern=r"(?u)\b[\w.+#-]+\b")
        self._matrix = self._vectorizer.fit_transform(self._content)

    def list_courses(self):
        return self.courses

    def recommend(self, query, limit=5, difficulty=None, category=None, language=None):
        query = self._normalize_query(query)
        filters = self._infer_filters(query, difficulty, category, language)
        expanded_query = self._expand_query(query)

        candidates = self.df.copy()
        for column, value in filters.items():
            if value:
                candidates = candidates[candidates[column].astype(str).str.lower() == value.lower()]

        if candidates.empty:
            return []

        candidate_indexes = candidates.index.tolist()
        scores = cosine_similarity(
            self._vectorizer.transform([expanded_query]),
            self._matrix[candidate_indexes],
        )[0]

        scored_rows = []
        for position, score in enumerate(scores):
            row_index = candidate_indexes[position]
            row = self.df.loc[row_index]
            boosted_score = score + self._metadata_boost(query, row)
            scored_rows.append((boosted_score, row_index))

        scored_rows.sort(key=lambda item: item[0], reverse=True)
        selected_indexes = [row_index for score, row_index in scored_rows[: self._clean_limit(limit)] if score > 0]

        if not selected_indexes and filters:
            selected_indexes = candidate_indexes[: self._clean_limit(limit)]

        return [self._course_dict(self.df.loc[index]) for index in selected_indexes]

    def _normalize_query(self, query):
        words = re.findall(r"[\w.+#-]+", str(query or "").lower())
        corrected = []

        for word in words:
            if word in self._vocabulary or word in DIFFICULTIES or word in QUERY_SYNONYMS:
                corrected.append(word)
                continue

            match = get_close_matches(word, self._vocabulary, n=1, cutoff=0.82)
            corrected.append(match[0] if match else word)

        return " ".join(corrected).strip()

    def _expand_query(self, query):
        words = query.split()
        expanded = list(words)

        for word in words:
            expanded.extend(QUERY_SYNONYMS.get(word, "").split())

        return " ".join(expanded).strip()

    def _infer_filters(self, query, difficulty, category, language):
        filters = {
            "difficulty": str(difficulty).strip().lower() if difficulty else None,
            "category": str(category).strip() if category else None,
            "language": str(language).strip() if language else None,
        }

        query_words = set(query.split())
        if not filters["difficulty"]:
            matched_difficulties = query_words & DIFFICULTIES
            if matched_difficulties:
                filters["difficulty"] = sorted(matched_difficulties)[0]

        if not filters["category"]:
            categories = {str(value).lower(): str(value) for value in self.df["category"].unique()}
            for category_key, category_value in categories.items():
                if category_key in query:
                    filters["category"] = category_value
                    break

        return filters

    def _metadata_boost(self, query, row):
        score = 0.0
        text_values = {column: str(row[column]).lower() for column in TEXT_COLUMNS}

        if query and query in text_values["title"]:
            score += 0.6
        if query and query in text_values["tags"]:
            score += 0.4
        if query and query == text_values["category"]:
            score += 0.5
        if "website" in query or "websites" in query:
            if text_values["category"] in {"frontend", "web development"}:
                score += 0.4
            if text_values["category"] == "backend":
                score -= 0.5

        try:
            score += float(row["rating"]) / 100
        except (TypeError, ValueError):
            pass

        return score

    def _build_vocabulary(self):
        tokens = set()
        for column in SEARCH_COLUMNS:
            for value in self.df[column].astype(str):
                tokens.update(re.findall(r"[\w.+#-]+", value.lower()))
        tokens.update(QUERY_SYNONYMS.keys())
        return tokens

    def _clean_limit(self, limit):
        try:
            return max(1, min(int(limit), 10))
        except (TypeError, ValueError):
            return 5

    def _course_dict(self, row):
        return {column: row[column].item() if hasattr(row[column], "item") else row[column] for column in self.df.columns}


class Recommender:
    def __init__(self, data_path=DEFAULT_DATA_PATH):
        from models.embedder import get_embeddings

        self.df = pd.read_csv(data_path).fillna("")
        self.df["content"] = self.df[TEXT_COLUMNS].agg(" ".join, axis=1)
        self.embeddings = get_embeddings(self.df["content"].astype(str).tolist())
        self.similarity = cosine_similarity(self.embeddings)

    def get_similar(self, course_title):
        matches = self.df[self.df["title"].str.lower() == str(course_title).lower()]
        if matches.empty:
            matches = self.df[self.df["title"].str.contains(str(course_title), case=False, regex=False)]
        if matches.empty:
            return []

        idx = matches.index[0]
        scores = list(enumerate(self.similarity[idx]))
        scores = sorted(scores, key=lambda item: item[1], reverse=True)

        return [self.df.iloc[index].to_dict() for index, _score in scores[1:6]]
