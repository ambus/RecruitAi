import React, { useState } from 'react';
import { View } from '../../../App';
import { generateInterviewSummary, generateNewQuestions } from '../../../services/geminiService';
import { Difficulty, InterviewSession, Question } from '../../../types';
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

  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [generationCategory, setGenerationCategory] = useState(categories[0] || '');
  const [generationTopic, setGenerationTopic] = useState('');
  const [generationDifficulty, setGenerationDifficulty] = useState<Difficulty>('Mid');

  const [isAddingManualQuestion, setIsAddingManualQuestion] = useState(false);
  const [manualQuestionText, setManualQuestionText] = useState('');
  const [manualCategory, setManualCategory] = useState(categories[0] || '');
  const [manualDifficulty, setManualDifficulty] = useState<Difficulty>('Mid');
  const [manualCorrectAnswer, setManualCorrectAnswer] = useState('');

  const allSessionQuestions = [...questions, ...(session.temporaryQuestions || [])];
  const allCategories = Array.from(
    new Set([...categories, ...(session.temporaryQuestions?.map((q) => q.category) || [])]),
  );

  const questionsByCategory = allCategories
    .map((cat) => ({
      name: cat,
      questions: allSessionQuestions.filter((q) => q.category === cat),
    }))
    .filter((cat) => cat.questions.length > 0);

  const handleGenerateQuestion = async () => {
    if (!userAiKey) {
      alert('Brak klucza API do wygenerowania pytania.');
      return;
    }
    const targetCat = generationCategory || categories[0] || 'Inne';
    setIsGeneratingQuestion(true);
    try {
      const newQs = await generateNewQuestions(userAiKey, targetCat, generationTopic, 1, generationDifficulty);
      if (newQs && newQs.length > 0) {
        const generatedQ: Question = {
          id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          category: targetCat,
          question: newQs[0].question || '',
          correctAnswer: newQs[0].correctAnswer || '',
          difficulty: generationDifficulty,
        };
        const currentTempQs = session.temporaryQuestions || [];
        setSession({ ...session, temporaryQuestions: [...currentTempQs, generatedQ] });
        setGenerationTopic('');
      }
    } catch (e: any) {
      alert('Błąd podczas generowania: ' + (e.message || ''));
    } finally {
      setIsGeneratingQuestion(false);
    }
  };

  const handleAddManualQuestion = () => {
    if (!manualQuestionText.trim()) return;
    const targetCat = manualCategory || categories[0] || 'Inne';
    const newQ: Question = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      category: targetCat,
      question: manualQuestionText,
      correctAnswer: manualCorrectAnswer || 'Brak',
      difficulty: manualDifficulty,
    };
    const currentTempQs = session.temporaryQuestions || [];
    setSession({ ...session, temporaryQuestions: [...currentTempQs, newQ] });
    setManualQuestionText('');
    setManualCorrectAnswer('');
    setIsAddingManualQuestion(false);
  };

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
    const allSessionQuestionsForSummary = [...questions, ...(session.temporaryQuestions || [])];

    if (userAiKey) {
      setIsSummarizing(true);
      try {
        // Dodajemy timeout zabezpieczający przed zawieszeniem w przypadku braku połączenia
        summary = await Promise.race([
          generateInterviewSummary(userAiKey, session, allSessionQuestionsForSummary),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('Przekroczono czas oczekiwania na połączenie z AI.')), 20000),
          ),
        ]);
      } catch (e: any) {
        console.error(e);
        summary = 'Podsumowanie niedostępne (brak połączenia z AI lub błąd): ' + (e.message || '');
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
          <h2 className='text-2xl font-black text-slate-800 border-l-4 border-indigo-600 pl-4 py-1 mb-4 flex items-center justify-between'>
            Dodaj punktowane pytanie
            <span className='text-sm font-normal text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full'>
              Tymczasowe na czas rozmowy
            </span>
          </h2>
          <div className='bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6 mb-8'>
            <div className='flex gap-4 border-b border-slate-200 pb-4'>
              <button
                onClick={() => setIsAddingManualQuestion(false)}
                className={`flex-1 py-2 rounded-lg font-bold transition-colors ${!isAddingManualQuestion ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                Wygeneruj przez AI
              </button>
              <button
                onClick={() => setIsAddingManualQuestion(true)}
                className={`flex-1 py-2 rounded-lg font-bold transition-colors ${isAddingManualQuestion ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              >
                Dodaj Ręcznie
              </button>
            </div>

            {!isAddingManualQuestion ? (
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <label className='block text-sm font-bold text-slate-700'>Kategoria</label>
                  <select
                    className='w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none'
                    value={generationCategory}
                    onChange={(e) => setGenerationCategory(e.target.value)}
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='space-y-2'>
                  <label className='block text-sm font-bold text-slate-700'>Poziom trudności</label>
                  <select
                    className='w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none'
                    value={generationDifficulty}
                    onChange={(e) => setGenerationDifficulty(e.target.value as Difficulty)}
                  >
                    <option value='Junior'>Junior</option>
                    <option value='Mid'>Mid</option>
                    <option value='Senior'>Senior</option>
                  </select>
                </div>
                <div className='space-y-2 md:col-span-2'>
                  <label className='block text-sm font-bold text-slate-700'>Temat poboczny (opcjonalnie)</label>
                  <input
                    type='text'
                    className='w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none'
                    placeholder='np. React Hooks zapytania do API, Optymalizacja...'
                    value={generationTopic}
                    onChange={(e) => setGenerationTopic(e.target.value)}
                  />
                </div>
                <div className='md:col-span-2 flex justify-end pt-2'>
                  <button
                    onClick={handleGenerateQuestion}
                    disabled={isGeneratingQuestion || !userAiKey}
                    className={`px-6 py-2 rounded-lg font-bold shadow-md text-white ${isGeneratingQuestion || !userAiKey ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  >
                    {isGeneratingQuestion
                      ? 'Trwa generowanie...'
                      : userAiKey
                        ? '✨ Wygeneruj i dodaj'
                        : 'Brak klucza API'}
                  </button>
                </div>
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <label className='block text-sm font-bold text-slate-700'>Kategoria</label>
                  <div className='flex gap-2 w-full'>
                    <select
                      className='w-full p-2 border border-slate-200 rounded-lg bg-slate-50 flex-1 focus:ring-2 focus:ring-indigo-500 outline-none'
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value)}
                    >
                      {allCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <button
                      title='Wpisz nową kategorię'
                      onClick={() => {
                        const newCat = prompt('Nowa kategoria:');
                        if (newCat) setManualCategory(newCat);
                      }}
                      className='px-3 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200 font-bold text-xl transition-colors'
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className='space-y-2'>
                  <label className='block text-sm font-bold text-slate-700'>Poziom trudności</label>
                  <select
                    className='w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none'
                    value={manualDifficulty}
                    onChange={(e) => setManualDifficulty(e.target.value as Difficulty)}
                  >
                    <option value='Junior'>Junior</option>
                    <option value='Mid'>Mid</option>
                    <option value='Senior'>Senior</option>
                  </select>
                </div>
                <div className='space-y-2 md:col-span-2'>
                  <label className='block text-sm font-bold text-slate-700'>Treść pytania</label>
                  <input
                    type='text'
                    className='w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none'
                    placeholder='Wpisz tutaj swoje pytanie...'
                    value={manualQuestionText}
                    onChange={(e) => setManualQuestionText(e.target.value)}
                  />
                </div>
                <div className='space-y-2 md:col-span-2'>
                  <label className='block text-sm font-bold text-slate-700'>
                    Poprawna odpowiedź / Oczekiwane punkty (opcjonalnie)
                  </label>
                  <textarea
                    className='w-full min-h-[80px] p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none text-sm'
                    placeholder='Wymagane pojęcia to m.in...'
                    value={manualCorrectAnswer}
                    onChange={(e) => setManualCorrectAnswer(e.target.value)}
                  />
                </div>
                <div className='md:col-span-2 flex justify-end pt-2'>
                  <button
                    onClick={handleAddManualQuestion}
                    disabled={!manualQuestionText.trim()}
                    className={`px-6 py-2 rounded-lg font-bold shadow-md text-white ${!manualQuestionText.trim() ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  >
                    Dodaj pytanie
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

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
