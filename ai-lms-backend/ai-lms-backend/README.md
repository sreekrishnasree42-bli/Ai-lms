# AI LMS Backend

Complete REST API backend for the AI Learning Management System React frontend.

---

## Project Structure

```
ai-lms-backend/
│
├── config/
│   └── db.js                   # MongoDB connection with retry logic
│
├── controllers/
│   ├── authController.js        # register, login, getMe, user CRUD
│   ├── courseController.js      # course CRUD, enroll, getMyCourses
│   ├── quizController.js        # submit score + AI feedback, quiz CRUD
│   └── progressController.js   # dashboard stats + AI recommendation
│
├── middleware/
│   ├── authMiddleware.js        # JWT protect + role authorize
│   ├── errorHandler.js          # centralised error formatter + createError()
│   └── rateLimiter.js           # auth / api / ai rate limiters
│
├── models/
│   ├── User.js                  # name, email, password, role, enrolledCourses
│   ├── Course.js                # title, description, videoUrl, recommendation
│   ├── Quiz.js                  # questions, attempts, AI feedback
│   └── Progress.js             # completedCount, averageScore, recommendation
│
├── routes/
│   ├── authRoutes.js            # POST /api/register  POST /api/login
│   ├── courseRoutes.js          # GET  /api/courses   GET /api/courses/:id
│   ├── quizRoutes.js            # POST /api/quiz  (submit score)
│   └── progressRoutes.js       # GET  /api/progress  (dashboard)
│
├── utils/
│   ├── generateToken.js         # JWT signer
│   └── seed.js                  # demo data (3 users, 3 courses, 4 quizzes)
│
├── .env.example                 # copy to .env and fill in values
├── package.json
└── server.js                    # Express app entry point
```

---

## Frontend → Backend Endpoint Map

| Frontend File     | HTTP Call                                          | Backend Route              |
|-------------------|----------------------------------------------------|----------------------------|
| `Login.jsx`       | `POST /api/login`  `{ email, password }`           | `authRoutes` → `login`     |
| `Register.jsx`    | `POST /api/register`  `{ name, email, password }`  | `authRoutes` → `register`  |
| `Dashboard.jsx`   | `GET  /api/progress`  (Auth header)                | `progressRoutes` → `getProgress` |
| `Courses.jsx`     | `GET  /api/courses`                                | `courseRoutes` → `getCourses` |
| `CourseDetails.jsx` | `GET /api/courses/:id`                           | `courseRoutes` → `getCourseById` |
| `Quiz.jsx`        | `POST /api/quiz`  `{ score }`                      | `quizRoutes` → `submitQuiz` |

---

## Quick Start

### 1. Prerequisites
- Node.js ≥ 18
- MongoDB running locally (`mongod`) **or** a MongoDB Atlas connection string

### 2. Install & Configure

```bash
cd ai-lms-backend
npm install

# Create your .env from the template
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/ai_lms
JWT_SECRET=replace_with_long_random_string
JWT_EXPIRE=7d
ANTHROPIC_API_KEY=sk-ant-...      # optional — AI features degrade gracefully without it
CLIENT_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 3. Seed Demo Data

```bash
npm run seed
```

Creates:
| Role       | Email                    | Password    |
|------------|--------------------------|-------------|
| Admin      | admin@ailms.com          | password123 |
| Instructor | instructor@ailms.com     | password123 |
| Student    | student@ailms.com        | password123 |

Also creates 3 courses, 4 quizzes, and 1 progress record.

### 4. Start the Server

```bash
npm run dev      # development — auto-restarts on file changes (nodemon)
npm start        # production
```

Server starts at **http://localhost:5000**

---

## Complete API Reference + Postman Sample Bodies

### Base URL
```
http://localhost:5000/api
```

### Authentication
All protected routes require:
```
Authorization: Bearer <token>
```
or just the raw token in the `token` header (matching the frontend).

---

### AUTH ENDPOINTS

#### POST /api/register
**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Registered successfully",
  "token": "eyJhbGci...",
  "user": { "id": "...", "name": "John Doe", "email": "john@example.com", "role": "student" }
}
```

---

#### POST /api/login
**Body:**
```json
{
  "email": "student@ailms.com",
  "password": "password123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGci...",
  "user": { "id": "...", "name": "John Doe", "email": "student@ailms.com", "role": "student" }
}
```
> 💡 The frontend stores `res.data.token` in `localStorage`.

---

#### GET /api/me
**Headers:** `Authorization: Bearer <token>`
**Response:** Full user profile with enrolled courses.

---

#### GET /api/users
**Headers:** `Authorization: Bearer <admin-token>`
**Query params:** `?role=student`, `?search=john`, `?page=1&limit=20`

---

#### PUT /api/users/:id
**Headers:** `Authorization: Bearer <token>` (self or admin)
**Body:**
```json
{ "name": "Updated Name" }
```

---

#### DELETE /api/users/:id
**Headers:** `Authorization: Bearer <admin-token>`

---

### COURSE ENDPOINTS

#### GET /api/courses
Returns all published courses. No auth required.
**Query params:** `?search=react`, `?category=Web Development`, `?level=Beginner`
**Response:**
```json
{
  "success": true,
  "total": 3,
  "page": 1,
  "courses": [
    {
      "_id": "...",
      "title": "Introduction to React",
      "description": "...",
      "category": "Web Development",
      "level": "Beginner",
      "thumbnail": "",
      "instructor": { "name": "Dr. Jane Smith" }
    }
  ]
}
```

---

#### GET /api/courses/:id
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "enrolled": true,
  "course": {
    "_id": "...",
    "title": "Introduction to React",
    "description": "Learn React from scratch...",
    "videoUrl": "https://www.youtube.com/embed/bMknfKXIFA8",
    "recommendation": "Focus on useEffect and useState.",
    "instructor": { "name": "Dr. Jane Smith" }
  }
}
```

---

#### POST /api/courses
**Headers:** `Authorization: Bearer <instructor-token>`
**Body:**
```json
{
  "title": "Advanced TypeScript",
  "description": "Master TypeScript — generics, decorators, advanced types.",
  "category": "Web Development",
  "level": "Advanced",
  "videoUrl": "https://www.youtube.com/embed/example",
  "thumbnail": "https://example.com/thumb.jpg",
  "isPublished": true
}
```

---

#### PUT /api/courses/:id
**Headers:** `Authorization: Bearer <instructor-token>`
**Body:** (any subset of course fields)
```json
{
  "title": "Advanced TypeScript — Updated",
  "isPublished": true,
  "recommendation": "Practice with real projects!"
}
```

---

#### DELETE /api/courses/:id
**Headers:** `Authorization: Bearer <instructor-token>`

---

#### POST /api/courses/:id/enroll
**Headers:** `Authorization: Bearer <student-token>`
**Body:** *(none required)*
**Response:**
```json
{ "success": true, "message": "Enrolled successfully" }
```

---

### QUIZ ENDPOINTS

#### POST /api/quiz  ← Primary frontend endpoint
**Headers:** `Authorization: Bearer <student-token>`
**Body (minimal — matches Quiz.jsx exactly):**
```json
{ "score": 80 }
```
**Body (full — with quiz reference for detailed grading):**
```json
{
  "score": 80,
  "quizId": "<quiz-object-id>",
  "courseId": "<course-object-id>",
  "answers": [
    { "questionIndex": 0, "selectedOption": 1 },
    { "questionIndex": 1, "selectedOption": 0 },
    { "questionIndex": 2, "selectedOption": 2 },
    { "questionIndex": 3, "selectedOption": 2 }
  ],
  "timeTaken": 120
}
```
**Response:**
```json
{
  "success": true,
  "message": "Score saved! AI will analyse your performance.",
  "result": {
    "score": 80,
    "passed": true,
    "averageScore": 74,
    "aiFeedback": "Great effort! Review React Hooks to push your average above 80%."
  }
}
```

---

#### POST /api/quiz/create
**Headers:** `Authorization: Bearer <instructor-token>`
**Body:**
```json
{
  "title": "Quiz 1 — JavaScript Basics",
  "courseId": "<course-id>",
  "passingScore": 60,
  "isPublished": true,
  "questions": [
    {
      "text": "What does === check in JavaScript?",
      "options": ["value only", "type only", "value and type", "none"],
      "correctAnswer": 2,
      "points": 25
    },
    {
      "text": "Which keyword declares a constant?",
      "options": ["let", "var", "const", "def"],
      "correctAnswer": 2,
      "points": 25
    }
  ]
}
```

---

#### GET /api/quiz
**Headers:** `Authorization: Bearer <token>`
**Query:** `?courseId=<id>` (optional)

---

#### GET /api/quiz/:id
**Headers:** `Authorization: Bearer <token>`
> Students see questions without `correctAnswer`. Instructors see everything.

---

#### GET /api/quiz/:id/results
**Headers:** `Authorization: Bearer <instructor-token>`
Returns all student attempts for this quiz.

---

#### PUT /api/quiz/:id
**Headers:** `Authorization: Bearer <instructor-token>`
**Body:** (any subset)
```json
{ "passingScore": 70, "isPublished": false }
```

---

#### DELETE /api/quiz/:id
**Headers:** `Authorization: Bearer <instructor-token>`

---

### PROGRESS ENDPOINTS

#### GET /api/progress  ← Primary frontend endpoint (Dashboard.jsx)
**Headers:** `Authorization: Bearer <student-token>`
**Response (matches Dashboard.jsx exactly):**
```json
{
  "completed": 1,
  "score": 74,
  "recommendation": "You're doing great! Review Quiz 2 on React Hooks...",
  "courses": [...],
  "quizScores": [...],
  "chartScores": [75, 50, 80, 90],
  "totalQuizzes": 4,
  "lastUpdated": "2025-01-15T10:30:00.000Z"
}
```
> `completed` → `data.completed` in Dashboard.jsx  
> `score` → `data.score` in Dashboard.jsx  
> `recommendation` → `data.recommendation` in Dashboard.jsx

---

#### POST /api/progress/complete
**Headers:** `Authorization: Bearer <student-token>`
**Body:**
```json
{ "courseId": "<course-id>" }
```
**Response:**
```json
{ "success": true, "message": "Course marked as completed", "completed": 2, "score": 74 }
```

---

#### POST /api/progress/ai-recommendation
**Headers:** `Authorization: Bearer <student-token>`
Triggers a fresh Claude AI recommendation based on current progress.

---

#### GET /api/progress/all
**Headers:** `Authorization: Bearer <admin-token>`
Returns all students' progress summaries.

---

### UTILITY ENDPOINTS

#### GET /
```json
{ "success": true, "message": "AI LMS API is running 🚀" }
```

#### GET /api/health
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected",
  "uptime": "142s",
  "ai": "configured"
}
```

---

## Role Permissions Summary

| Endpoint                        | student | instructor | admin |
|---------------------------------|:-------:|:----------:|:-----:|
| POST /api/register              | ✅      | ✅         | ✅    |
| POST /api/login                 | ✅      | ✅         | ✅    |
| GET  /api/courses               | ✅      | ✅         | ✅    |
| GET  /api/courses/:id           | ✅      | ✅         | ✅    |
| POST /api/courses               | ❌      | ✅         | ✅    |
| PUT  /api/courses/:id           | ❌      | ✅ (own)   | ✅    |
| DELETE /api/courses/:id         | ❌      | ✅ (own)   | ✅    |
| POST /api/courses/:id/enroll    | ✅      | ❌         | ❌    |
| POST /api/quiz  (submit score)  | ✅      | ❌         | ❌    |
| POST /api/quiz/create           | ❌      | ✅         | ✅    |
| PUT  /api/quiz/:id              | ❌      | ✅ (own)   | ✅    |
| DELETE /api/quiz/:id            | ❌      | ✅ (own)   | ✅    |
| GET  /api/quiz/:id/results      | ❌      | ✅         | ✅    |
| GET  /api/progress              | ✅      | ❌         | ❌    |
| GET  /api/progress/all          | ❌      | ❌         | ✅    |
| GET  /api/users                 | ❌      | ❌         | ✅    |
| DELETE /api/users/:id           | ❌      | ❌         | ✅    |

---

## Error Response Format

All errors follow a consistent shape:

```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

Common status codes:
| Code | Meaning                        |
|------|-------------------------------|
| 400  | Bad request / missing fields  |
| 401  | Unauthorised (no/bad token)   |
| 403  | Forbidden (wrong role)        |
| 404  | Resource not found            |
| 409  | Conflict (duplicate email)    |
| 422  | Validation error              |
| 429  | Rate limit exceeded           |
| 500  | Internal server error         |
| 503  | AI service not configured     |
