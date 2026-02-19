import React, { useEffect, useMemo, useRef, useState } from 'react';
import CandidateForm from './components/CandidateForm';
import RatingScale from './components/RatingScale';
import { DEFAULT_CATEGORIES, QUESTIONS as INITIAL_QUESTIONS } from './constants';
import {
  addDoc,
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  googleProvider,
  onAuthStateChanged,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  signInWithPopup,
  signOut,
  updateDoc,
  User,
} from './services/firebase';
import { generateInterviewSummary, generateNewQuestions } from './services/geminiService';
import { Candidate, InterviewSession, Question } from './types';

type View = 'START' | 'FORM' | 'INTERVIEW' | 'HISTORY' | 'SUMMARY' | 'QUESTIONS_MGMT';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>('START');
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [history, setHistory] = useState<InterviewSession[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Management states
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [showCategoryMgmt, setShowCategoryMgmt] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ old: string; new: string } | null>(null);

  // AI Generation state
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiGenParams, setAiGenParams] = useState({ category: '', topic: '', count: 3 });
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const historyFileInputRef = useRef<HTMLInputElement>(null);
  const questionsFileInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore Sync
  useEffect(() => {
    if (!user) return;

    // Sync Categories
    const catRef = doc(db, 'settings', 'categories');
    const unsubCats = onSnapshot(catRef, (docSnap) => {
      if (docSnap.exists()) {
        setCategories(docSnap.data().list || DEFAULT_CATEGORIES);
      } else {
        setDoc(catRef, { list: DEFAULT_CATEGORIES });
      }
    });

    // Sync Questions with Privacy Filter
    const qQuery = query(collection(db, 'questions'));
    const unsubQs = onSnapshot(qQuery, (snap) => {
      const qs: Question[] = [];
      snap.forEach((d) => {
        const data = d.data() as Question;
        // Visible if: Public OR created by current user OR it is one of the initial questions (no createdBy)
        const isVisible = !data.isPrivate || data.createdBy === user.uid || !data.createdBy;
        if (isVisible) {
          qs.push({ id: d.id, ...data });
        }
      });
      setQuestions(qs.length > 0 ? qs : INITIAL_QUESTIONS);
    });

    // Sync History
    const hQuery = query(collection(db, 'interviews'), orderBy('candidate.interviewDate', 'desc'));
    const unsubHistory = onSnapshot(hQuery, (snap) => {
      const hs: InterviewSession[] = [];
      snap.forEach((d) => hs.push(d.data() as InterviewSession));
      setHistory(hs);
    });

    return () => {
      unsubCats();
      unsubQs();
      unsubHistory();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const saveToHistory = async (completedSession: InterviewSession) => {
    try {
      await addDoc(collection(db, 'interviews'), completedSession);
    } catch (error) {
      console.error('Failed to save history to Firebase', error);
    }
  };

  const handleExportQuestions = () => {
    const exportData = { questions, categories };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recruit_ai_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportQuestionsFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        let importedQuestions: Question[] = [];
        let importedCategories: string[] = [];

        if (Array.isArray(imported)) {
          importedQuestions = imported;
        } else if (imported.questions && imported.categories) {
          importedQuestions = imported.questions;
          importedCategories = imported.categories;
        }

        if (confirm('Import zsynchronizuje dane z Firebase. Kontynuować?')) {
          for (const q of importedQuestions) {
            const { id, ...data } = q;
            // When importing, mark as owned by user if not specified
            await addDoc(collection(db, 'questions'), {
              ...data,
              createdBy: data.createdBy || user?.uid,
              isPrivate: data.isPrivate || false,
            });
          }
          if (importedCategories.length > 0) {
            await setDoc(doc(db, 'settings', 'categories'), {
              list: Array.from(new Set([...categories, ...importedCategories])),
            });
          }
          alert('Dane zaimportowane do chmury.');
        }
      } catch (err) {
        alert('Błąd importu.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleAddCategory = async () => {
    if (!newCategoryName || categories.includes(newCategoryName)) return;
    const newList = [...categories, newCategoryName];
    await setDoc(doc(db, 'settings', 'categories'), { list: newList });
    setNewCategoryName('');
  };

  const handleDeleteCategory = async (cat: string) => {
    const count = questions.filter((q) => q.category === cat).length;
    if (count > 0) {
      if (!confirm(`Kategoria "${cat}" zawiera ${count} pytań. Czy na pewno chcesz ją usunąć?`)) return;
    }
    const newList = categories.filter((c) => c !== cat);
    await setDoc(doc(db, 'settings', 'categories'), { list: newList });
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editingCategory.new || categories.includes(editingCategory.new)) return;

    const newList = categories.map((c) => (c === editingCategory.old ? editingCategory.new : c));
    await setDoc(doc(db, 'settings', 'categories'), { list: newList });

    const toUpdate = questions.filter((q) => q.category === editingCategory.old);
    for (const q of toUpdate) {
      await updateDoc(doc(db, 'questions', q.id), { category: editingCategory.new });
    }

    setEditingCategory(null);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion?.question || !editingQuestion?.category || !editingQuestion?.correctAnswer) return;

    const { id, ...data } = editingQuestion;
    if (id) {
      await updateDoc(doc(db, 'questions', id), {
        ...data,
        // Optional: you might want to prevent others from editing your questions via Firestore rules,
        // but here we ensure the UI matches the owner.
      });
    } else {
      await addDoc(collection(db, 'questions'), {
        ...data,
        createdBy: user?.uid,
        isPrivate: !!editingQuestion.isPrivate,
      });
    }
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (confirm('Usunąć pytanie z bazy Firebase?')) {
      await deleteDoc(doc(db, 'questions', id));
    }
  };

  const handleAiGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiGenParams.category) return;

    setIsGeneratingAi(true);
    try {
      const newQuestions = await generateNewQuestions(aiGenParams.category, aiGenParams.topic, aiGenParams.count);
      for (const q of newQuestions) {
        await addDoc(collection(db, 'questions'), {
          ...q,
          category: aiGenParams.category,
          createdBy: user?.uid,
          isPrivate: false, // Default to public for AI generated if wanted, or could be private
        });
      }
      setShowAiGen(false);
      alert(`Wygenerowano i zapisano w Firebase ${newQuestions.length} pytań.`);
    } catch (err) {
      alert('Wystąpił błąd podczas generowania pytań.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleStartInterview = (candidate: Candidate) => {
    setSession({ candidate, scores: [], isCompleted: false });
    setView('INTERVIEW');
  };

  const handleRate = (questionId: string, rating: number) => {
    if (!session) return;
    setSession((prev) => {
      if (!prev) return null;
      const existingIdx = prev.scores.findIndex((s) => s.questionId === questionId);
      const newScores = [...prev.scores];
      if (existingIdx >= 0) newScores[existingIdx] = { ...newScores[existingIdx], rating };
      else newScores.push({ questionId, rating });
      return { ...prev, scores: newScores };
    });
  };

  const handleFinish = async () => {
    if (!session) return;
    setIsSummarizing(true);
    const summary = await generateInterviewSummary(session, questions);
    const completedSession = { ...session, isCompleted: true, aiSummary: summary };
    setSession(completedSession);
    await saveToHistory(completedSession);
    setIsSummarizing(false);
    setView('SUMMARY');
  };

  const calculateCategoryAverage = (cat: string, targetSession: InterviewSession | null) => {
    if (!targetSession) return 0;
    const catQuestions = questions.filter((q) => q.category === cat).map((q) => q.id);
    const scores = targetSession.scores.filter((s) => catQuestions.includes(s.questionId));
    if (scores.length === 0) return 0;
    return scores.reduce((acc, curr) => acc + curr.rating, 0) / scores.length;
  };

  const calculateTotalAverage = (targetSession: InterviewSession | null) => {
    if (!targetSession || targetSession.scores.length === 0) return 0;
    return targetSession.scores.reduce((acc, curr) => acc + curr.rating, 0) / targetSession.scores.length;
  };

  const questionsByCategory = useMemo(() => {
    return categories.map((cat) => ({
      name: cat,
      questions: questions.filter((q) => q.category === cat),
    }));
  }, [questions, categories]);

  if (authLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-slate-50'>
        <div className='animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50'>
        <div className='bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full text-center'>
          <h1 className='text-4xl font-black text-slate-800 mb-2'>
            Recruit<span className='text-blue-600'>AI</span>
          </h1>
          <p className='text-slate-500 mb-8'>Zaloguj się, aby uzyskać dostęp do panelu rekrutera.</p>
          <button
            onClick={handleLogin}
            className='w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition-all shadow-sm'
          >
            <img
              src='https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg'
              className='w-5 h-5'
              alt='Google'
            />
            Zaloguj przez Google
          </button>
        </div>
      </div>
    );
  }

  // View: START
  if (view === 'START') {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50'>
        <div className='absolute top-6 right-6 flex items-center gap-4'>
          <div className='text-right'>
            <p className='text-sm font-bold text-slate-800'>{user.displayName}</p>
            <button onClick={handleLogout} className='text-xs text-red-500 hover:underline'>
              Wyloguj
            </button>
          </div>
          <img src={user.photoURL || ''} className='w-10 h-10 rounded-full border border-slate-200' alt='Avatar' />
        </div>

        <h1 className='text-5xl font-black text-center mb-4 text-slate-800 tracking-tight'>
          Recruit<span className='text-blue-600'>AI</span>
        </h1>
        <p className='text-slate-500 mb-12 text-lg text-center'>Chmurowy asystent rekrutacji technicznej</p>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl'>
          <button
            onClick={() => setView('FORM')}
            className='group p-8 bg-white border-2 border-transparent hover:border-blue-500 rounded-3xl shadow-xl transition-all flex flex-col items-center gap-4 text-center'
          >
            <div className='w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform'>
              <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 4v16m8-8H4' />
              </svg>
            </div>
            <h3 className='text-xl font-bold text-slate-800'>Nowa Rozmowa</h3>
          </button>
          <button
            onClick={() => setView('HISTORY')}
            className='group p-8 bg-white border-2 border-transparent hover:border-blue-500 rounded-3xl shadow-xl transition-all flex flex-col items-center gap-4 text-center'
          >
            <div className='w-16 h-16 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform'>
              <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
            </div>
            <h3 className='text-xl font-bold text-slate-800'>Historia Rozmów</h3>
          </button>
          <button
            onClick={() => setView('QUESTIONS_MGMT')}
            className='group p-8 bg-white border-2 border-transparent hover:border-blue-500 rounded-3xl shadow-xl transition-all flex flex-col items-center gap-4 text-center'
          >
            <div className='w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform'>
              <svg className='w-8 h-8' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
            </div>
            <h3 className='text-xl font-bold text-slate-800'>Baza Pytań</h3>
          </button>
        </div>
      </div>
    );
  }

  // View: QUESTIONS_MGMT
  if (view === 'QUESTIONS_MGMT') {
    return (
      <div className='min-h-screen p-6 md:p-12 max-w-5xl mx-auto'>
        <header className='flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4'>
          <div>
            <h1 className='text-3xl font-bold text-slate-800'>Zarządzanie Bazą</h1>
            <p className='text-slate-500'>Dane synchronizowane z Firebase</p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <button
              onClick={() => setShowAiGen(true)}
              className='px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-md flex items-center gap-2'
            >
              <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 10V3L4 14h7v7l9-11h-7z' />
              </svg>
              AI Generuj
            </button>
            <button
              onClick={() => setShowCategoryMgmt(true)}
              className='px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-sm'
            >
              Kategorie
            </button>
            <button
              onClick={handleExportQuestions}
              className='px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                />
              </svg>
              Eksport
            </button>
            <button
              onClick={() => questionsFileInputRef.current?.click()}
              className='px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12'
                />
              </svg>
              Import
            </button>
            <input
              type='file'
              ref={questionsFileInputRef}
              onChange={handleImportQuestionsFile}
              accept='.json'
              className='hidden'
            />
            <button
              onClick={() => setEditingQuestion({ category: categories[0] || '', isPrivate: false })}
              className='px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md'
            >
              + Pytanie
            </button>
            <button
              onClick={() => setView('START')}
              className='px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-colors'
            >
              Menu
            </button>
          </div>
        </header>

        {showAiGen && (
          <div className='fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
            <div className='bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md'>
              <h3 className='text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2'>
                <svg className='w-6 h-6 text-blue-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M13 10V3L4 14h7v7l9-11h-7z' />
                </svg>
                AI w Chmurze
              </h3>
              <form onSubmit={handleAiGenerate} className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-slate-600 mb-1'>Docelowa Kategoria</label>
                  <select
                    className='w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900'
                    value={aiGenParams.category}
                    required
                    onChange={(e) => setAiGenParams({ ...aiGenParams, category: e.target.value })}
                  >
                    <option value=''>Wybierz...</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-medium text-slate-600 mb-1'>Temat / Słowa kluczowe</label>
                  <input
                    type='text'
                    className='w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900'
                    placeholder='np. React Hooks, Flexbox'
                    value={aiGenParams.topic}
                    onChange={(e) => setAiGenParams({ ...aiGenParams, topic: e.target.value })}
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-slate-600 mb-1'>
                    Liczba pytań: {aiGenParams.count}
                  </label>
                  <input
                    type='range'
                    min='1'
                    max='10'
                    value={aiGenParams.count}
                    onChange={(e) => setAiGenParams({ ...aiGenParams, count: parseInt(e.target.value) })}
                    className='w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600'
                  />
                </div>
                <div className='flex gap-4 pt-4'>
                  <button
                    type='submit'
                    disabled={isGeneratingAi}
                    className='flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-300'
                  >
                    {isGeneratingAi ? 'Generowanie...' : 'Generuj i Zapisz'}
                  </button>
                  <button
                    type='button'
                    onClick={() => setShowAiGen(false)}
                    className='flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-lg hover:bg-slate-200 transition-colors'
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showCategoryMgmt && (
          <div className='fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
            <div className='bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md'>
              <div className='flex justify-between items-center mb-6'>
                <h3 className='text-2xl font-bold text-slate-800'>Kategorie w Chmurze</h3>
                <button onClick={() => setShowCategoryMgmt(false)} className='text-slate-400 hover:text-red-500'>
                  <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12' />
                  </svg>
                </button>
              </div>
              <div className='flex gap-2 mb-6'>
                <input
                  type='text'
                  className='flex-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900'
                  placeholder='Nowa...'
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <button onClick={handleAddCategory} className='px-4 py-2 bg-blue-600 text-white font-bold rounded-lg'>
                  Dodaj
                </button>
              </div>
              <div className='space-y-2 max-h-64 overflow-y-auto'>
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className='flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100'
                  >
                    {editingCategory?.old === cat ? (
                      <input
                        className='flex-1 bg-white border border-blue-400 rounded px-2 py-1 text-slate-900 outline-none'
                        value={editingCategory.new}
                        autoFocus
                        onChange={(e) => setEditingCategory({ ...editingCategory, new: e.target.value })}
                        onBlur={handleUpdateCategory}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory()}
                      />
                    ) : (
                      <span className='font-medium text-slate-700'>{cat}</span>
                    )}
                    <div className='flex gap-1'>
                      <button
                        onClick={() => setEditingCategory({ old: cat, new: cat })}
                        className='p-1 text-slate-400 hover:text-blue-600'
                      >
                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className='p-1 text-slate-400 hover:text-red-500'
                      >
                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {editingQuestion && (
          <div className='fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
            <div className='bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg'>
              <h3 className='text-2xl font-bold mb-6 text-slate-800'>
                {editingQuestion.id ? 'Edytuj (Firebase)' : 'Nowe (Firebase)'}
              </h3>
              <form onSubmit={handleSaveQuestion} className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-slate-600 mb-1'>Kategoria</label>
                  <select
                    className='w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900'
                    value={editingQuestion.category}
                    required
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                  >
                    <option value=''>Wybierz kategorię</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-medium text-slate-600 mb-1'>Pytanie</label>
                  <textarea
                    className='w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] bg-white text-slate-900'
                    value={editingQuestion.question || ''}
                    placeholder='Treść...'
                    required
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-slate-600 mb-1'>Prawidłowa Odpowiedź</label>
                  <textarea
                    className='w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] bg-white text-slate-900'
                    value={editingQuestion.correctAnswer || ''}
                    placeholder='Modelowa odpowiedź...'
                    required
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })}
                  />
                </div>
                <div className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    id='isPrivate'
                    checked={editingQuestion.isPrivate || false}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, isPrivate: e.target.checked })}
                    className='w-5 h-5 accent-blue-600'
                  />
                  <label htmlFor='isPrivate' className='text-slate-700 font-medium select-none cursor-pointer'>
                    Oznacz jako prywatne (widoczne tylko dla Ciebie)
                  </label>
                </div>
                <div className='flex gap-4 pt-4'>
                  <button
                    type='submit'
                    className='flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors'
                  >
                    Zapisz w Chmurze
                  </button>
                  <button
                    type='button'
                    onClick={() => setEditingQuestion(null)}
                    className='flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-lg hover:bg-slate-200 transition-colors'
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className='space-y-8'>
          {questionsByCategory.map((catGroup) => (
            <div key={catGroup.name}>
              <h2 className='text-xl font-black text-slate-800 border-l-4 border-purple-500 pl-4 mb-4'>
                {catGroup.name}
              </h2>
              <div className='grid gap-3'>
                {catGroup.questions.map((q) => (
                  <div
                    key={q.id}
                    className='bg-white p-5 rounded-xl border border-slate-200 flex justify-between items-center group'
                  >
                    <div className='flex-1 pr-8 flex items-center gap-3'>
                      {q.isPrivate && (
                        <span className='bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1 shadow-sm shrink-0'>
                          <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
                            <path
                              fillRule='evenodd'
                              d='M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z'
                              clipRule='evenodd'
                            />
                          </svg>
                          Prywatne
                        </span>
                      )}
                      <p className='font-semibold text-slate-700'>{q.question}</p>
                    </div>
                    <div className='flex gap-2'>
                      <button
                        onClick={() => setEditingQuestion(q)}
                        className='p-2 text-slate-400 hover:text-blue-600 transition-colors'
                      >
                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className='p-2 text-slate-400 hover:text-red-500 transition-colors'
                      >
                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {catGroup.questions.length === 0 && <p className='text-slate-400 text-sm italic'>Brak pytań.</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // View: FORM
  if (view === 'FORM') {
    return (
      <div className='min-h-screen py-12 px-4'>
        <button
          onClick={() => setView('START')}
          className='mb-8 flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mx-auto max-w-md w-full'
        >
          <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
          </svg>
          Menu
        </button>
        <CandidateForm onStart={handleStartInterview} />
      </div>
    );
  }

  // View: HISTORY
  if (view === 'HISTORY') {
    return (
      <div className='min-h-screen p-6 md:p-12 max-w-4xl mx-auto'>
        <header className='flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4'>
          <div>
            <h1 className='text-3xl font-bold text-slate-800'>Historia (Firebase)</h1>
          </div>
          <div className='flex gap-2'>
            <button
              onClick={() => setView('START')}
              className='px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-colors'
            >
              Menu
            </button>
          </div>
        </header>
        <div className='grid gap-4'>
          {history.map((h, idx) => (
            <div
              key={idx}
              onClick={() => {
                setSession(h);
                setView('SUMMARY');
              }}
              className='bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-400 cursor-pointer transition-all flex items-center justify-between group'
            >
              <div className='flex items-center gap-4'>
                <div className='w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-bold'>
                  {h.candidate.name.charAt(0)}
                </div>
                <div>
                  <h3 className='font-bold text-slate-800'>{h.candidate.name}</h3>
                  <p className='text-slate-400 text-sm'>{h.candidate.interviewDate}</p>
                </div>
              </div>
              <div className='text-xl font-black text-slate-700'>{calculateTotalAverage(h).toFixed(1)}/5</div>
            </div>
          ))}
          {history.length === 0 && (
            <p className='text-center py-12 text-slate-400 italic'>Brak zapisanych rozmów w Firebase.</p>
          )}
        </div>
      </div>
    );
  }

  // View: INTERVIEW
  if (view === 'INTERVIEW' && session) {
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
            className='px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md disabled:bg-slate-200'
          >
            {isSummarizing ? 'Generowanie...' : 'Zakończ'}
          </button>
        </nav>
        <main className='flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full space-y-12 pb-20'>
          {questionsByCategory.map((category) => (
            <section key={category.name} className='space-y-4'>
              <h2 className='text-2xl font-black text-slate-800 border-l-4 border-blue-600 pl-4 py-1'>
                {category.name}
              </h2>
              <div className='grid gap-4'>
                {category.questions.map((q) => {
                  const score = session.scores.find((s) => s.questionId === q.id);
                  const isExpanded = expandedQuestion === q.id;
                  return (
                    <div
                      key={q.id}
                      className='bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow'
                    >
                      <div className='p-5 flex flex-col md:flex-row md:items-center justify-between gap-4'>
                        <div className='flex-1 pr-4 flex items-center gap-3'>
                          {q.isPrivate && (
                            <svg className='w-4 h-4 text-amber-500 shrink-0' fill='currentColor' viewBox='0 0 20 20'>
                              <path
                                fillRule='evenodd'
                                d='M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z'
                                clipRule='evenodd'
                              />
                            </svg>
                          )}
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
        </main>
      </div>
    );
  }

  // View: SUMMARY
  if (view === 'SUMMARY' && session) {
    return (
      <div className='min-h-screen p-6 md:p-12 max-w-4xl mx-auto'>
        <div className='bg-white rounded-2xl shadow-2xl p-8 border border-slate-100'>
          <header className='flex justify-between items-start mb-10 border-b pb-6'>
            <div>
              <button
                onClick={() => setView('START')}
                className='mb-4 text-slate-400 hover:text-blue-600 flex items-center gap-1 text-sm font-bold'
              >
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
                </svg>
                Wyjdź
              </button>
              <h1 className='text-3xl font-bold text-slate-800'>Podsumowanie</h1>
              <p className='text-slate-500'>{session.candidate.name}</p>
            </div>
            <div className='text-right'>
              <span className='text-xs font-black text-slate-400 uppercase block mb-1'>Wynik Ogólny</span>
              <div className='text-4xl font-black text-blue-600'>{calculateTotalAverage(session).toFixed(1)}/5.0</div>
            </div>
          </header>

          <section className='grid grid-cols-2 md:grid-cols-3 gap-4 mb-10'>
            {categories.map((cat) => {
              const avg = calculateCategoryAverage(cat, session);
              if (avg === 0) return null;
              return (
                <div key={cat} className='p-4 bg-slate-50 rounded-xl border border-slate-100'>
                  <div className='text-xs font-bold text-slate-400 uppercase'>{cat}</div>
                  <div className='text-xl font-bold text-slate-700'>{avg.toFixed(1)} / 5</div>
                </div>
              );
            })}
          </section>

          <div className='prose max-w-none text-slate-700 bg-blue-50/50 p-6 rounded-xl border border-blue-100 whitespace-pre-wrap leading-relaxed shadow-inner mb-10'>
            {session.aiSummary}
          </div>

          <button
            onClick={() => setView('START')}
            className='w-full py-4 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 shadow-lg transition-all'
          >
            Zamknij i Wróć
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
