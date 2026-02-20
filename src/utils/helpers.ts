import { Difficulty, InterviewSession, Question } from '../../types';

export const calculateTotalAverage = (targetSession: InterviewSession | null) => {
  if (!targetSession || targetSession.scores.length === 0) return 0;
  return targetSession.scores.reduce((acc, curr) => acc + curr.rating, 0) / targetSession.scores.length;
};

export const calculateCategoryAverage = (
  cat: string,
  targetSession: InterviewSession | null,
  questions: Question[],
) => {
  if (!targetSession) return 0;
  const catQuestions = questions.filter((q) => q.category === cat).map((q) => q.id);
  const scores = targetSession.scores.filter((s) => catQuestions.includes(s.questionId));
  if (scores.length === 0) return 0;
  return scores.reduce((acc, curr) => acc + curr.rating, 0) / scores.length;
};

export const difficultyColor = (difficulty?: Difficulty) => {
  switch (difficulty) {
    case 'Junior':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'Mid':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Senior':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};
