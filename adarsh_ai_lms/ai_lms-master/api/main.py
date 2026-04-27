from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from models.recommender import CourseRecommender


HOST = "127.0.0.1"
PORT = 8000
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "courses.csv"

API_DESCRIPTION = """
Search and recommend LMS courses from the local course catalog.

The API reads courses from `data/courses.csv`, ranks matches locally with TF-IDF,
and supports optional filters for difficulty, category, and language.
"""

app = FastAPI(
    title="AI LMS Course Recommendation API",
    description=API_DESCRIPTION,
    version="1.0.0",
    contact={"name": "AI LMS Team"},
    openapi_tags=[
        {
            "name": "Health",
            "description": "Basic API status and discovery endpoints.",
        },
        {
            "name": "Courses",
            "description": "Read-only access to the course catalog.",
        },
        {
            "name": "Recommendations",
            "description": "Course search and recommendation endpoints.",
        },
    ],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

recommender = CourseRecommender(DATA_PATH)


class Course(BaseModel):
    course_id: str = Field(..., examples=["C107"])
    title: str = Field(..., examples=["Python for Beginners"])
    description: str = Field(..., examples=["Introduction to Python programming with hands on exercises"])
    category: str = Field(..., examples=["Programming"])
    tags: str = Field(..., examples=["python,basics"])
    difficulty: str = Field(..., examples=["beginner"])
    duration_hours: int = Field(..., examples=[14])
    instructor: str = Field(..., examples=["Meera Pillai"])
    rating: float = Field(..., examples=[4.3])
    total_students: int = Field(..., examples=[1100])
    language: str = Field(..., examples=["English"])


class RootResponse(BaseModel):
    message: str
    courses_endpoint: str
    recommend_endpoint: str
    docs_endpoint: str


class CourseListResponse(BaseModel):
    count: int
    courses: list[Course]


class RecommendationResponse(BaseModel):
    query: str
    count: int
    recommendations: list[Course]


class RecommendationRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=1,
        description="Course topic or learning goal, such as `python`, `beginner react`, or `build websites`.",
        examples=["beginner react"],
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Maximum number of recommendations to return.",
        examples=[3],
    )
    difficulty: str | None = Field(
        default=None,
        description="Optional difficulty filter.",
        examples=["beginner"],
    )
    category: str | None = Field(
        default=None,
        description="Optional category filter, such as `Programming`, `Frontend`, `AI`, or `Design`.",
        examples=["Frontend"],
    )
    language: str | None = Field(
        default=None,
        description="Optional language filter.",
        examples=["English"],
    )


@app.get(
    "/",
    response_model=RootResponse,
    tags=["Health"],
    summary="Check API status",
    description="Returns a small status payload and points clients to the main catalog, recommendation, and docs endpoints.",
)
def root():
    return {
        "message": "AI LMS recommendation API is running",
        "courses_endpoint": "/courses",
        "recommend_endpoint": "/recommend?query=python",
        "docs_endpoint": "/docs",
    }


@app.get(
    "/courses",
    response_model=CourseListResponse,
    tags=["Courses"],
    summary="List all courses",
    description="Returns every course currently available in `data/courses.csv`.",
)
def courses():
    return {
        "count": len(recommender.courses),
        "courses": recommender.list_courses(),
    }


@app.get(
    "/recommend",
    response_model=RecommendationResponse,
    tags=["Recommendations"],
    summary="Recommend courses with query parameters",
    description=(
        "Returns ranked course recommendations for a search query. "
        "Use this endpoint from browsers, links, Postman query params, or simple frontend calls."
    ),
)
def recommend_get(
    query: str = Query(
        ...,
        min_length=1,
        description="Course topic or learning goal.",
        examples=["python"],
    ),
    limit: int = Query(
        default=5,
        ge=1,
        le=10,
        description="Maximum number of recommendations to return.",
        examples=[2],
    ),
    difficulty: str | None = Query(
        default=None,
        description="Optional difficulty filter.",
        examples=["beginner"],
    ),
    category: str | None = Query(
        default=None,
        description="Optional category filter.",
        examples=["Programming"],
    ),
    language: str | None = Query(
        default=None,
        description="Optional language filter.",
        examples=["English"],
    ),
):
    recommendations = recommender.recommend(
        query=query,
        limit=limit,
        difficulty=difficulty,
        category=category,
        language=language,
    )
    return {
        "query": query,
        "count": len(recommendations),
        "recommendations": recommendations,
    }


@app.post(
    "/recommend",
    response_model=RecommendationResponse,
    tags=["Recommendations"],
    summary="Recommend courses with a JSON body",
    description=(
        "Returns ranked course recommendations from a JSON request body. "
        "Use this endpoint when the client already sends JSON or when filters are easier to pass in a body."
    ),
)
def recommend_post(payload: RecommendationRequest):
    recommendations = recommender.recommend(
        query=payload.query,
        limit=payload.limit,
        difficulty=payload.difficulty,
        category=payload.category,
        language=payload.language,
    )
    return {
        "query": payload.query,
        "count": len(recommendations),
        "recommendations": recommendations,
    }


def main():
    try:
        import uvicorn
    except ImportError as exc:
        raise RuntimeError("uvicorn is required to run the API") from exc

    print(f"AI LMS API running at http://{HOST}:{PORT}")
    print(f"Swagger docs: http://{HOST}:{PORT}/docs")
    print(f"Browser test: http://{HOST}:{PORT}/recommend?query=python")
    uvicorn.run("api.main:app", host=HOST, port=PORT, reload=False)


if __name__ == "__main__":
    main()
