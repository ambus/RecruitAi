
export interface Question {
  id: string;
  category: string;
  question: string;
  correctAnswer: string;
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
}
