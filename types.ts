export type Difficulty = 'Junior' | 'Mid' | 'Senior';

export interface Question {
  id: string;
  category: string;
  question: string;
  correctAnswer: string;
  isPrivate?: boolean;
  createdBy?: string;
  difficulty?: Difficulty;
}

export interface Score {
  questionId: string;
  rating: number; // 1-5
  comment?: string;
}

export interface Candidate {
  id: string;
  name: string;
  interviewDate: string;
}

export interface InterviewSession {
  candidate: Candidate;
  scores: Score[];
  isCompleted: boolean;
  aiSummary?: string;
  overallComment?: string;
  createdBy?: string;
}
