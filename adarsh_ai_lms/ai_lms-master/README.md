# AI LMS Course Recommendation API

FastAPI service for recommending LMS courses from `data/courses.csv`.

## What It Does

- Lists available courses.
- Recommends courses from a search query.
- Supports filters for difficulty, category, and language.
- Handles natural queries like `beginner react`, `build websites`, and small typos like `pyhton`.
- Exposes interactive Swagger docs at `/docs`.

## Project Structure

```text
ai_lms/
|-- api/
|   |-- __init__.py
|   `-- main.py
|-- data/
|   `-- courses.csv
|-- models/
|   |-- __init__.py
|   |-- embedder.py
|   |-- ranker.py
|   `-- recommender.py
|-- tests/
|   |-- test_api.py
|   `-- test_recommender.py
|-- server.py
|-- requirements.txt
`-- README.md
```

## Setup

Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
python -m pip install -r requirements.txt
```

No `.env` file is required for the current FastAPI app. The recommender reads from `data/courses.csv` and runs locally.

## Run The API

```powershell
python server.py
```

The API runs at:

```text
http://127.0.0.1:8000
```

Open the docs:

```text
http://127.0.0.1:8000/docs
```

The Swagger UI lets you inspect endpoints, see request and response schemas, fill in parameters, and run test requests from the browser.

You can also start it directly with Uvicorn:

```powershell
python -m uvicorn api.main:app --reload
```

Stop the server with `Ctrl+C`.

## Endpoints

### `GET /`

Use this as a basic health check. It confirms that the API is running and returns links for the course catalog, recommendation endpoint, and Swagger docs.

Example:

```text
http://127.0.0.1:8000/
```

### `GET /courses`

Use this to fetch the full course catalog from `data/courses.csv`. This is useful when a frontend needs to show all available courses or build filter dropdowns.

Example:

```text
http://127.0.0.1:8000/courses
```

### `GET /recommend`

Use this to get recommendations with query parameters. This is the easiest endpoint to test in a browser or call from a simple frontend.

Query parameters:

```text
query       required  Course topic or learning goal
limit       optional  Number of results to return, from 1 to 10
difficulty  optional  Filter by beginner, intermediate, or advanced
category    optional  Filter by category, such as Programming, Frontend, AI, or Design
language    optional  Filter by language, such as English
```

Example:

```text
http://127.0.0.1:8000/recommend?query=python&limit=2
```

### `POST /recommend`

Use this to get recommendations with a JSON body. This is useful for backend integrations, Postman testing, or frontend forms that already send JSON.

Body:

```json
{
  "query": "beginner react",
  "limit": 2,
  "difficulty": "beginner",
  "category": "Frontend",
  "language": "English"
}
```

Only `query` is required. All other fields are optional.

## Swagger UI

Open:

```text
http://127.0.0.1:8000/docs
```

In Swagger UI:

1. Expand an endpoint, such as `GET /recommend`.
2. Select `Try it out`.
3. Enter a query like `python`, `beginner react`, or `build websites`.
4. Set optional filters if needed.
5. Select `Execute`.
6. Review the response body, status code, and generated request URL.

Available Swagger groups:

```text
Health           GET /
Courses          GET /courses
Recommendations GET /recommend, POST /recommend
```

## Browser Examples

```text
http://127.0.0.1:8000/recommend?query=python
```

```text
http://127.0.0.1:8000/recommend?query=react&difficulty=beginner&limit=3
```

```text
http://127.0.0.1:8000/recommend?query=build%20websites&limit=4
```

## Postman Examples

GET:

```text
http://127.0.0.1:8000/recommend?query=python&limit=2
```

POST:

```text
http://127.0.0.1:8000/recommend
```

Body:

```json
{
  "query": "beginner react",
  "limit": 2
}
```

## Example Response

```json
{
  "query": "python",
  "count": 1,
  "recommendations": [
    {
      "course_id": "C107",
      "title": "Python for Beginners",
      "description": "Introduction to Python programming with hands on exercises",
      "category": "Programming",
      "tags": "python,basics",
      "difficulty": "beginner",
      "duration_hours": 14,
      "instructor": "Meera Pillai",
      "rating": 4.3,
      "total_students": 1100,
      "language": "English"
    }
  ]
}
```

## Run Tests

```powershell
python -m unittest discover -s tests
```

## Notes

`models/recommender.py` contains the main API recommender. It uses TF-IDF scoring over the course CSV so the API starts quickly.

`models/embedder.py` still supports sentence-transformer embeddings for the legacy `Recommender` class. It now converts pandas Series inputs to a list of strings before calling `model.encode()`, which fixes the `Unsupported input type: Series` crash.
