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
  getDoc,
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
  where,
} from './services/firebase';
import { generateCategorySuggestions, generateInterviewSummary, generateNewQuestions } from './services/geminiService';
import { Candidate, Difficulty, InterviewSession, Question } from './types';

type View = 'START' | 'FORM' | 'INTERVIEW' | 'HISTORY' | 'SUMMARY' | 'QUESTIONS_MGMT' | 'SETTINGS';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>('START');
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [history, setHistory] = useState<InterviewSession[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // User Settings state
  const [userAiKey, setUserAiKey] = useState<string>(localStorage.getItem('gemini_api_key') || '');

  // Management states
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [showCategoryMgmt, setShowCategoryMgmt] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ old: string; new: string } | null>(null);

  // AI Generation state
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiGenParams, setAiGenParams] = useState<{
    category: string;
    topic: string;
    count: number;
    difficulty: Difficulty;
  }>({
    category: '',
    topic: '',
    count: 3,
    difficulty: 'Mid',
  });
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<Partial<Question>[] | null>(null);
  const [selectedPreviewIndices, setSelectedPreviewIndices] = useState<Set<number>>(new Set());

  // AI Category Suggestion state
  const [isSuggestingCategories, setIsSuggestingCategories] = useState(false);
  const [categoryAiPrompt, setCategoryAiPrompt] = useState('');

  const questionsFileInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener + Authorization Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setIsAuthorized(true);
          } else {
            console.warn(`User ${currentUser.uid} not found in 'users' collection.`);
            setIsAuthorized(false);
          }
        } catch (error) {
          console.error('Błąd autoryzacji Firestore:', error);
          setIsAuthorized(false);
        }
      } else {
        setUser(null);
        setIsAuthorized(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Firestore Sync
  useEffect(() => {
    if (!user || !isAuthorized) return;

    const catRef = doc(db, 'settings', 'categories');
    const unsubCats = onSnapshot(catRef, (docSnap) => {
      if (docSnap.exists()) {
        setCategories(docSnap.data().list || DEFAULT_CATEGORIES);
      } else {
        setDoc(catRef, { list: DEFAULT_CATEGORIES });
      }
    });

    const qQuery = query(collection(db, 'questions'));
    const unsubQs = onSnapshot(qQuery, (snap) => {
      const qs: Question[] = [];
      snap.forEach((d) => {
        const data = d.data() as Question;
        const isVisible = !data.isPrivate || data.createdBy === user.uid || !data.createdBy;
        if (isVisible) {
          qs.push({ id: d.id, ...data });
        }
      });
      setQuestions(qs.length > 0 ? qs : INITIAL_QUESTIONS);
    });

    // Filtrowanie historii: tylko rozmowy utworzone przez aktualnego użytkownika
    const hQuery = query(
      collection(db, 'interviews'),
      where('createdBy', '==', user.uid),
      orderBy('candidate.interviewDate', 'desc'),
    );
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
  }, [user, isAuthorized]);

  const handleLogin = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
      setAuthLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const saveToHistory = async (completedSession: InterviewSession) => {
    try {
      // Upewniamy się, że createdBy jest ustawione przed zapisem
      await addDoc(collection(db, 'interviews'), {
        ...completedSession,
        createdBy: user?.uid,
      });
    } catch (error) {
      console.error('Failed to save history to Firebase', error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName || categories.includes(newCategoryName)) return;
    const newList = [...categories, newCategoryName];
    await setDoc(doc(db, 'settings', 'categories'), { list: newList });
    setNewCategoryName('');
  };

  const handleAiSuggestCategories = async () => {
    if (!categoryAiPrompt) return;
    if (!userAiKey) {
      alert('Skonfiguruj klucz API Gemini w ustawieniach.');
      return;
    }

    setIsSuggestingCategories(true);
    try {
      const suggested = await generateCategorySuggestions(userAiKey, categoryAiPrompt);
      const newList = Array.from(new Set([...categories, ...suggested]));
      await setDoc(doc(db, 'settings', 'categories'), { list: newList });
      setCategoryAiPrompt('');
      alert(`Dodano ${suggested.length} nowych kategorii sugerowanych przez AI.`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSuggestingCategories(false);
    }
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
    if (!editingCategory || !editingCategory.new || categories.includes(editingCategory.new)) {
      setEditingCategory(null);
      return;
    }

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
    const difficulty = editingQuestion.difficulty || 'Mid';

    if (id) {
      await updateDoc(doc(db, 'questions', id), {
        ...data,
        difficulty,
      });
    } else {
      await addDoc(collection(db, 'questions'), {
        ...data,
        createdBy: user?.uid,
        isPrivate: !!editingQuestion.isPrivate,
        difficulty,
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
    if (!userAiKey) {
      alert('Najpierw skonfiguruj klucz API Gemini w ustawieniach!');
      setView('SETTINGS');
      return;
    }

    setIsGeneratingAi(true);
    try {
      const newQuestions = await generateNewQuestions(
        userAiKey,
        aiGenParams.category,
        aiGenParams.topic,
        aiGenParams.count,
        aiGenParams.difficulty,
      );
      setGeneratedPreview(newQuestions);
      // Domyślnie zaznacz wszystkie
      setSelectedPreviewIndices(new Set(newQuestions.map((_, i) => i)));
    } catch (err: any) {
      alert(err.message || 'Wystąpił błąd podczas generowania pytań.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSaveSelectedQuestions = async () => {
    if (!generatedPreview) return;
    const toSave = Array.from(selectedPreviewIndices).map((idx) => generatedPreview[idx]);

    try {
      for (const q of toSave) {
        await addDoc(collection(db, 'questions'), {
          ...q,
          category: aiGenParams.category,
          createdBy: user?.uid,
          isPrivate: false,
          difficulty: aiGenParams.difficulty,
        });
      }
      alert(`Zapisano ${toSave.length} pytań w Firebase.`);
      setGeneratedPreview(null);
      setSelectedPreviewIndices(new Set());
      setShowAiGen(false);
    } catch (err) {
      alert('Błąd podczas zapisywania pytań.');
    }
  };

  const togglePreviewSelection = (index: number) => {
    const next = new Set(selectedPreviewIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedPreviewIndices(next);
  };

  const handleStartInterview = (candidate: Candidate) => {
    setSession({ candidate, scores: [], isCompleted: false, overallComment: '', createdBy: user?.uid });
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

  const handleUpdateOverallComment = (comment: string) => {
    if (!session) return;
    setSession((prev) => (prev ? { ...prev, overallComment: comment } : null));
  };

  const handleFinish = async () => {
    if (!session) return;

    let summary = 'Podsumowanie niedostępne (brak klucza API).';
    if (userAiKey) {
      setIsSummarizing(true);
      summary = await generateInterviewSummary(userAiKey, session, questions);
    }

    const completedSession = { ...session, isCompleted: true, aiSummary: summary, createdBy: user?.uid };
    setSession(completedSession);
    await saveToHistory(completedSession);
    setIsSummarizing(false);
    setView('SUMMARY');
  };

  const handleSaveAiKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gemini_api_key', userAiKey);
    alert('Klucz API został zapisany lokalnie.');
    setView('START');
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

  const difficultyColor = (difficulty?: Difficulty) => {
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

  if (isAuthorized === false) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50'>
        <div className='bg-white p-10 rounded-3xl shadow-2xl border border-red-100 max-w-md w-full text-center'>
          <div className='w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6'>
            <svg className='w-10 h-10' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
              />
            </svg>
          </div>
          <h2 className='text-2xl font-black text-slate-800 mb-2'>Brak Uprawnień</h2>
          <p className='text-slate-500 mb-8 leading-relaxed'>
            Twój adres e-mail (<span className='font-bold'>{user.email}</span>) nie posiada dostępu do tej platformy.
          </p>
          <div className='bg-slate-50 p-3 rounded-lg mb-8 text-xs font-mono text-slate-400 break-all select-all'>
            Twoje UID: {user.uid}
          </div>
          <button
            onClick={handleLogout}
            className='w-full bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-900 transition-all shadow-md'
          >
            Wyloguj i spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  if (view === 'START') {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 relative'>
        <div className='absolute top-6 right-6 flex items-center gap-4'>
          <button
            onClick={() => setView('SETTINGS')}
            className='p-2 bg-white border border-slate-200 rounded-full text-slate-500 hover:text-blue-600 transition-colors shadow-sm'
            title='Ustawienia AI'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
              />
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
            </svg>
          </button>
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

        {!userAiKey && (
          <div className='bg-amber-50 border border-amber-100 text-amber-700 px-6 py-4 rounded-2xl mb-8 flex items-center gap-4 max-w-lg'>
            <svg className='w-6 h-6 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
              />
            </svg>
            <p className='text-sm'>
              Brak klucza API Gemini.
              <button onClick={() => setView('SETTINGS')} className='ml-2 font-bold underline'>
                Skonfiguruj teraz
              </button>
            </p>
          </div>
        )}

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

  if (view === 'SETTINGS') {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50'>
        <div className='bg-white p-10 rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full'>
          <button
            onClick={() => setView('START')}
            className='mb-6 flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors'
          >
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
            </svg>
            Powrót
          </button>
          <h2 className='text-3xl font-black text-slate-800 mb-2'>Ustawienia</h2>
          <form onSubmit={handleSaveAiKey} className='space-y-6'>
            <div>
              <label className='block text-sm font-black text-slate-600 mb-2 uppercase tracking-wide'>
                Klucz Gemini API
              </label>
              <input
                type='password'
                value={userAiKey}
                onChange={(e) => setUserAiKey(e.target.value)}
                placeholder='Wklej swój klucz...'
                className='w-full px-5 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-900 transition-all font-mono'
                required
              />
            </div>
            <button
              type='submit'
              className='w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition-all'
            >
              Zapisz Ustawienia
            </button>
          </form>
        </div>
      </div>
    );
  }

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
              onClick={() => {
                setShowAiGen(true);
                setGeneratedPreview(null);
              }}
              disabled={!userAiKey}
              className={`px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-md flex items-center gap-2 ${!userAiKey ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              onClick={() => setEditingQuestion({ category: categories[0] || '', isPrivate: false, difficulty: 'Mid' })}
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
          <div className='fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto'>
            <div className='bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl my-auto'>
              {!generatedPreview ? (
                <>
                  <h3 className='text-2xl font-bold mb-6 text-slate-800'>AI Generuj Pytania</h3>
                  <form onSubmit={handleAiGenerate} className='space-y-4'>
                    <div>
                      <label className='block text-sm font-medium text-slate-600 mb-1'>Kategoria</label>
                      <select
                        className='w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900'
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
                      <label className='block text-sm font-medium text-slate-600 mb-1'>Trudność</label>
                      <select
                        className='w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900'
                        value={aiGenParams.difficulty}
                        required
                        onChange={(e) => setAiGenParams({ ...aiGenParams, difficulty: e.target.value as Difficulty })}
                      >
                        <option value='Junior'>Junior</option>
                        <option value='Mid'>Mid</option>
                        <option value='Senior'>Senior</option>
                      </select>
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
                    <div>
                      <label className='block text-sm font-medium text-slate-600 mb-1'>Temat / Słowa kluczowe</label>
                      <input
                        type='text'
                        className='w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900'
                        placeholder='np. React Hooks'
                        value={aiGenParams.topic}
                        onChange={(e) => setAiGenParams({ ...aiGenParams, topic: e.target.value })}
                      />
                    </div>
                    <button
                      type='submit'
                      disabled={isGeneratingAi}
                      className='w-full bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-slate-300'
                    >
                      {isGeneratingAi ? 'Generowanie...' : 'Pobierz propozycje'}
                    </button>
                    <button
                      type='button'
                      onClick={() => setShowAiGen(false)}
                      className='w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-lg'
                    >
                      Anuluj
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <h3 className='text-2xl font-bold mb-6 text-slate-800'>Wybierz pytania do zapisu</h3>
                  <p className='text-slate-500 mb-4 text-sm'>
                    Wybierz propozycje wygenerowane przez AI, które chcesz dodać do swojej bazy.
                  </p>
                  <div className='space-y-3 max-h-96 overflow-y-auto pr-2 mb-6'>
                    {generatedPreview.map((q, idx) => (
                      <div
                        key={idx}
                        onClick={() => togglePreviewSelection(idx)}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedPreviewIndices.has(idx) ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50 opacity-60'}`}
                      >
                        <div className='flex items-start gap-3'>
                          <div
                            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selectedPreviewIndices.has(idx) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}
                          >
                            {selectedPreviewIndices.has(idx) && (
                              <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
                                <path d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className='font-bold text-slate-800 text-sm mb-1'>{q.question}</p>
                            <p className='text-xs text-slate-500 italic'>{q.correctAnswer}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className='flex gap-4'>
                    <button
                      onClick={handleSaveSelectedQuestions}
                      disabled={selectedPreviewIndices.size === 0}
                      className='flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-slate-300'
                    >
                      Zapisz wybrane ({selectedPreviewIndices.size})
                    </button>
                    <button
                      onClick={() => setGeneratedPreview(null)}
                      className='flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-lg'
                    >
                      Wróć do ustawień
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showCategoryMgmt && (
          <div className='fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
            <div className='bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg'>
              <div className='flex justify-between items-center mb-6'>
                <h3 className='text-2xl font-bold text-slate-800'>Zarządzanie Kategoriami</h3>
                <button onClick={() => setShowCategoryMgmt(false)} className='text-slate-400 hover:text-red-500'>
                  <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12' />
                  </svg>
                </button>
              </div>

              {/* AI Category Generation Section */}
              <div className='bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6'>
                <label className='block text-xs font-black text-blue-600 uppercase mb-2'>
                  Generowanie kategorii przez AI
                </label>
                <div className='flex gap-2'>
                  <input
                    type='text'
                    className='flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500'
                    placeholder='Podaj stack, np. Node.js Backend...'
                    value={categoryAiPrompt}
                    onChange={(e) => setCategoryAiPrompt(e.target.value)}
                  />
                  <button
                    onClick={handleAiSuggestCategories}
                    disabled={isSuggestingCategories || !categoryAiPrompt}
                    className='px-4 py-2 bg-blue-600 text-white font-bold rounded-lg text-xs hover:bg-blue-700 disabled:bg-slate-300 flex items-center gap-1'
                  >
                    {isSuggestingCategories ? '...' : 'Sugeruj'}
                  </button>
                </div>
              </div>

              <div className='flex gap-2 mb-6'>
                <input
                  type='text'
                  className='flex-1 px-4 py-2 border border-slate-200 rounded-lg bg-white outline-none'
                  placeholder='Nowa kategoria...'
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <button onClick={handleAddCategory} className='px-4 py-2 bg-slate-800 text-white font-bold rounded-lg'>
                  Dodaj
                </button>
              </div>

              <div className='space-y-2 max-h-64 overflow-y-auto pr-2'>
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
                {editingQuestion.id ? 'Edytuj Pytanie' : 'Nowe Pytanie'}
              </h3>
              <form onSubmit={handleSaveQuestion} className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-slate-600 mb-1'>Kategoria</label>
                    <select
                      className='w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900'
                      value={editingQuestion.category}
                      required
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-slate-600 mb-1'>Trudność</label>
                    <select
                      className='w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900'
                      value={editingQuestion.difficulty || 'Mid'}
                      required
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as Difficulty })
                      }
                    >
                      <option value='Junior'>Junior</option>
                      <option value='Mid'>Mid</option>
                      <option value='Senior'>Senior</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-medium text-slate-600 mb-1'>Pytanie</label>
                  <textarea
                    className='w-full px-4 py-2 border border-slate-200 rounded-lg min-h-[80px] bg-white text-slate-900'
                    value={editingQuestion.question || ''}
                    required
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-slate-600 mb-1'>Odpowiedź</label>
                  <textarea
                    className='w-full px-4 py-2 border border-slate-200 rounded-lg min-h-[80px] bg-white text-slate-900'
                    value={editingQuestion.correctAnswer || ''}
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
                  <label htmlFor='isPrivate' className='text-slate-700 font-medium cursor-pointer'>
                    Prywatne
                  </label>
                </div>
                <div className='flex gap-4 pt-4'>
                  <button type='submit' className='flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg'>
                    Zapisz
                  </button>
                  <button
                    type='button'
                    onClick={() => setEditingQuestion(null)}
                    className='flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-lg'
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
                    <div className='flex-1 pr-8 flex flex-wrap items-center gap-3'>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${difficultyColor(q.difficulty)}`}
                      >
                        {q.difficulty || 'Mid'}
                      </span>
                      {q.isPrivate && (
                        <span className='bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 shrink-0'>
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
                    <div className='flex gap-2 shrink-0'>
                      <button onClick={() => setEditingQuestion(q)} className='p-2 text-slate-400 hover:text-blue-600'>
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
                        className='p-2 text-slate-400 hover:text-red-500'
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
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'FORM') {
    return (
      <div className='min-h-screen py-12 px-4'>
        <button
          onClick={() => setView('START')}
          className='mb-8 flex items-center gap-2 text-slate-500 hover:text-blue-600 mx-auto max-w-md w-full'
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

  if (view === 'HISTORY') {
    return (
      <div className='min-h-screen p-6 md:p-12 max-w-4xl mx-auto'>
        <header className='flex justify-between items-center mb-8'>
          <h1 className='text-3xl font-bold text-slate-800'>Historia</h1>
          <button
            onClick={() => setView('START')}
            className='px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg'
          >
            Menu
          </button>
        </header>
        <div className='grid gap-4'>
          {history.length > 0 ? (
            history.map((h, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setSession(h);
                  setView('SUMMARY');
                }}
                className='bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 cursor-pointer flex items-center justify-between group'
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
            ))
          ) : (
            <p className='text-center text-slate-500 py-10'>Nie masz jeszcze zapisanych żadnych rozmów.</p>
          )}
        </div>
      </div>
    );
  }

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
            className={`px-6 py-2 bg-green-600 text-white rounded-lg font-bold shadow-md ${!userAiKey ? 'bg-slate-400' : ''}`}
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

          {/* Overall Comment Section */}
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
  }

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
              <div className='text-4xl font-black text-blue-600'>{calculateTotalAverage(session).toFixed(1)}/5.0</div>
            </div>
          </header>

          {/* Section for overall comment in summary */}
          {session.overallComment && (
            <div className='mb-6'>
              <h3 className='text-xs font-black text-slate-400 uppercase mb-2'>Twoje notatki:</h3>
              <p className='text-slate-600 italic bg-slate-50 p-4 rounded-lg border border-slate-100'>
                {session.overallComment}
              </p>
            </div>
          )}

          <div className='prose max-w-none text-slate-700 bg-blue-50/50 p-6 rounded-xl border border-blue-100 whitespace-pre-wrap leading-relaxed shadow-inner mb-10'>
            {session.aiSummary}
          </div>
          <button onClick={() => setView('START')} className='w-full py-4 bg-slate-800 text-white font-bold rounded-xl'>
            Zamknij i Wróć
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
