import React, { useMemo, useState } from 'react';
import { View } from '../../App';
import { generateCategorySuggestions, generateNewQuestions } from '../../services/geminiService';
import { Difficulty, Question } from '../../types';
import { difficultyColor } from '../utils/helpers';

interface QuestionsMgmtViewProps {
  categories: string[];
  questions: Question[];
  userAiKey: string;
  setView: (view: View) => void;
  // Firebase handlers
  handleAddCategory: (name: string) => Promise<void>;
  handleDeleteCategory: (cat: string) => Promise<void>;
  handleUpdateCategory: (oldName: string, newName: string) => Promise<void>;
  handleUpdateCategoriesList: (list: string[]) => Promise<void>;
  handleSaveQuestion: (q: Partial<Question>) => Promise<void>;
  handleDeleteQuestion: (id: string) => Promise<void>;
  handleSaveMultipleQuestions: (qs: Partial<Question>[], cat: string, diff: string) => Promise<void>;
}

export const QuestionsMgmtView: React.FC<QuestionsMgmtViewProps> = ({
  categories,
  questions,
  userAiKey,
  setView,
  handleAddCategory,
  handleDeleteCategory,
  handleUpdateCategory,
  handleUpdateCategoriesList,
  handleSaveQuestion,
  handleDeleteQuestion,
  handleSaveMultipleQuestions,
}) => {
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiGenParams, setAiGenParams] = useState<{
    category: string;
    topic: string;
    count: number;
    difficulty: Difficulty;
  }>({ category: '', topic: '', count: 3, difficulty: 'Mid' });
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<Partial<Question>[] | null>(null);
  const [selectedPreviewIndices, setSelectedPreviewIndices] = useState<Set<number>>(new Set());

  const [isSuggestingCategories, setIsSuggestingCategories] = useState(false);
  const [categoryAiPrompt, setCategoryAiPrompt] = useState('');

  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [showCategoryMgmt, setShowCategoryMgmt] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ old: string; new: string } | null>(null);

  const questionsByCategory = useMemo(() => {
    return categories.map((cat) => ({
      name: cat,
      questions: questions.filter((q) => q.category === cat),
    }));
  }, [questions, categories]);

  const onAddCategoryClick = async () => {
    if (!newCategoryName || categories.includes(newCategoryName)) return;
    await handleAddCategory(newCategoryName);
    setNewCategoryName('');
  };

  const onAiSuggestCategoriesClick = async () => {
    if (!categoryAiPrompt) return;
    if (!userAiKey) {
      alert('Skonfiguruj klucz API Gemini w ustawieniach.');
      return;
    }

    setIsSuggestingCategories(true);
    try {
      const suggested = await generateCategorySuggestions(userAiKey, categoryAiPrompt);
      const newList = Array.from(new Set([...categories, ...suggested]));
      await handleUpdateCategoriesList(newList);
      setCategoryAiPrompt('');
      alert(`Dodano ${suggested.length} nowych kategorii sugerowanych przez AI.`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSuggestingCategories(false);
    }
  };

  const onDeleteCategoryClick = async (cat: string) => {
    const count = questions.filter((q) => q.category === cat).length;
    if (count > 0) {
      if (!confirm(`Kategoria "${cat}" zawiera ${count} pytań. Czy na pewno chcesz ją usunąć?`)) return;
    }
    await handleDeleteCategory(cat);
  };

  const onUpdateCategoryClick = async () => {
    if (!editingCategory || !editingCategory.new || categories.includes(editingCategory.new)) {
      setEditingCategory(null);
      return;
    }
    await handleUpdateCategory(editingCategory.old, editingCategory.new);
    setEditingCategory(null);
  };

  const onSaveQuestionClick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion?.question || !editingQuestion?.category || !editingQuestion?.correctAnswer) return;
    await handleSaveQuestion(editingQuestion);
    setEditingQuestion(null);
  };

  const onDeleteQuestionClick = async (id: string) => {
    if (confirm('Usunąć pytanie z bazy Firebase?')) {
      await handleDeleteQuestion(id);
    }
  };

  const onAiGenerateSubmit = async (e: React.FormEvent) => {
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
      setSelectedPreviewIndices(new Set(newQuestions.map((_, i) => i)));
    } catch (err: any) {
      alert(err.message || 'Wystąpił błąd podczas generowania pytań.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const onSaveSelectedClick = async () => {
    if (!generatedPreview) return;
    const toSave = Array.from(selectedPreviewIndices).map((idx) => generatedPreview[idx]);

    try {
      await handleSaveMultipleQuestions(toSave, aiGenParams.category, aiGenParams.difficulty);
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
                <form onSubmit={onAiGenerateSubmit} className='space-y-4'>
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
                    onClick={onSaveSelectedClick}
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
                  onClick={onAiSuggestCategoriesClick}
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
                onKeyDown={(e) => e.key === 'Enter' && onAddCategoryClick()}
              />
              <button onClick={onAddCategoryClick} className='px-4 py-2 bg-slate-800 text-white font-bold rounded-lg'>
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
                      onBlur={onUpdateCategoryClick}
                      onKeyDown={(e) => e.key === 'Enter' && onUpdateCategoryClick()}
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
                      onClick={() => onDeleteCategoryClick(cat)}
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
            <form onSubmit={onSaveQuestionClick} className='space-y-4'>
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
                      onClick={() => onDeleteQuestionClick(q.id)}
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
};
