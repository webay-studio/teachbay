export function activeCollection(path: string) {
  return path.startsWith("/questions")
    ? "questions"
    : path.startsWith("/exams")
      ? "exams"
      : undefined;
}
