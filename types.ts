export type Difficulty = 'Junior' | 'Mid' | 'Senior';

export interface Question {
  id: string;
  category: string;
  question: string;
  correctAnswer: string;
  isPrivate?: boolean;
  createdBy?: string;
  difficulty?: Difficulty;
  /** 'question' (default) or 'task' for practical coding/live tasks */
  type?: 'question' | 'task';
  /** Only for type === 'task': a URL the candidate can open */
  taskLink?: string;
  /** Only for type === 'task': what the candidate should do */
  taskDescription?: string;
  /** Only for type === 'task': what the optimal solution looks like */
  taskSolution?: string;
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
export interface AskedQuestion {
  id: string;
  category: string;
  question: string;
  difficulty?: Difficulty;
}

export interface InterviewSession {
  id?: string;
  candidate: Candidate;
  positionName: string;
  requirementsDescription: string;
  scores: Score[];
  askedQuestions?: AskedQuestion[];
  isCompleted: boolean;
  aiSummary?: string;
  aiSummaryTranslated?: string;
  temporaryQuestions?: Question[];
  overallComment?: string;
  createdBy?: string;
}
