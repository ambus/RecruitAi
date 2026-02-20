import React, { useState } from 'react';
import { View } from '../../../App';
import { generateInterviewSummary } from '../../../services/geminiService';
import { InterviewSession, Question } from '../../../types';
import { difficultyColor } from '../../utils/helpers';
import RatingScale from './RatingScale';

interface InterviewSessionViewProps {
  session: InterviewSession;
  setSession: (s: InterviewSession | null) => void;
  questions: Question[];
  categories: string[];
  userAiKey: string;
  userUid: string | undefined;
  setView: (view: View) => void;
  saveToHistory: (s: InterviewSession) => Promise<void>;
}

export const InterviewSessionView: React.FC<InterviewSessionViewProps> = ({
  session,
  setSession,
  questions,
  categories,
  userAiKey,
  userUid,
  setView,
  saveToHistory,
}) => {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const questionsByCategory = categories.map((cat) => ({
    name: cat,
    questions: questions.filter((q) => q.category === cat),
  }));

  const handleRate = (questionId: string, rating: number) => {
    const existingIdx = session.scores.findIndex((s) => s.questionId === questionId);
    const newScores = [...session.scores];
    if (existingIdx >= 0) newScores[existingIdx] = { ...newScores[existingIdx], rating };
    else newScores.push({ questionId, rating });
    setSession({ ...session, scores: newScores });
  };

  const handleUpdateOverallComment = (comment: string) => {
    setSession({ ...session, overallComment: comment });
  };

  const handleFinish = async () => {
    let summary = 'Podsumowanie niedostępne (brak klucza API).';
    if (userAiKey) {
      setIsSummarizing(true);
      try {
        summary = await generateInterviewSummary(userAiKey, session, questions);
      } catch (e: any) {
        console.error(e);
        summary = 'Wystąpił błąd podczas generowania podsumowania: ' + e.message;
      }
    }

    const completedSession = { ...session, isCompleted: true, aiSummary: summary, createdBy: userUid };
    setSession(completedSession);
    await saveToHistory(completedSession);
    setIsSummarizing(false);
    setView('SUMMARY');
  };

  return (
    <div className='min-h-screen flex flex-col bg-slate-50'>
      <nav className='bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm'>
        <div className='flex items-center gap-4'>
          <button
            onClick={() => confirm('Anulować?') && setView('START')}
            className='p-2 text-slate-400 hover:text-red-500'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
          <h1 className='text-xl font-bold text-slate-800'>{session.candidate.name}</h1>
        </div>
        <button
          onClick={handleFinish}
          disabled={isSummarizing}
          className={`px-6 py-2 bg-green-600 text-white rounded-lg font-bold shadow-md ${!userAiKey ? 'bg-slate-400' : ''}`}
        >
          {isSummarizing ? 'Generowanie...' : 'Zakończ'}
        </button>
      </nav>
      <main className='flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full space-y-12 pb-20'>
        {questionsByCategory.map((category) => (
          <section key={category.name} className='space-y-4'>
            <h2 className='text-2xl font-black text-slate-800 border-l-4 border-blue-600 pl-4 py-1'>{category.name}</h2>
            <div className='grid gap-4'>
              {category.questions.map((q) => {
                const score = session.scores.find((s) => s.questionId === q.id);
                const isExpanded = expandedQuestion === q.id;
                return (
                  <div key={q.id} className='bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm'>
                    <div className='p-5 flex flex-col md:flex-row md:items-center justify-between gap-4'>
                      <div className='flex-1 pr-4 flex flex-wrap items-center gap-3'>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${difficultyColor(q.difficulty)}`}
                        >
                          {q.difficulty || 'Mid'}
                        </span>
                        <h3 className='text-lg font-semibold text-slate-700'>{q.question}</h3>
                      </div>
                      <div className='flex items-center gap-4 shrink-0'>
                        <RatingScale value={score?.rating || 0} onChange={(val) => handleRate(q.id, val)} />
                        <button
                          onClick={() => setExpandedQuestion(isExpanded ? null : q.id)}
                          className={`p-2 rounded-lg ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}
                        >
                          <svg
                            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M19 9l-7 7-7-7' />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className='px-5 py-4 bg-slate-50 border-t border-slate-100'>
                        <p className='text-slate-600 italic'>
                          <span className='text-xs font-black text-blue-600 uppercase block mb-1'>
                            Prawidłowa odpowiedź:
                          </span>
                          {q.correctAnswer}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <section className='pt-8 border-t border-slate-200'>
          <h2 className='text-2xl font-black text-slate-800 border-l-4 border-slate-800 pl-4 py-1 mb-4'>
            Ogólny komentarz / Notatki rekrutera
          </h2>
          <div className='bg-white border border-slate-200 rounded-xl p-4 shadow-sm'>
            <textarea
              className='w-full min-h-[150px] p-4 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800'
              placeholder='Dodaj ogólne spostrzeżenia, które nie pasują do konkretnych pytań. Te uwagi zostaną uwzględnione przez AI przy generowaniu podsumowania...'
              value={session.overallComment || ''}
              onChange={(e) => handleUpdateOverallComment(e.target.value)}
            />
          </div>
        </section>
      </main>
    </div>
  );
};
