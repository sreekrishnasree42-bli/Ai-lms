def rank_courses(courses):

    ranked = []

    for course in courses:

        score = 0

        # base similarity weight
        score += 0.7

        # difficulty preference (example logic)
        if course["difficulty"] == "Beginner":
            score += 0.2

        # category boost
        if course["category"] == "Programming":
            score += 0.1

        ranked.append((course["title"], score))

    ranked.sort(key=lambda x: x[1], reverse=True)

    return [c[0] for c in ranked[:3]]