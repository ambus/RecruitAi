import React, { useState } from 'react';
import { View } from '../../../App';
import { translateSummaryToEnglish } from '../../../services/geminiService';
import { InterviewSession } from '../../../types';
import { calculateTotalAverage } from '../../utils/helpers';

interface InterviewSummaryViewProps {
  session: InterviewSession;
  setView: (view: View) => void;
  setSession?: (s: InterviewSession) => void;
  saveToHistory?: (s: InterviewSession) => Promise<void>;
  userAiKey?: string;
}

export const InterviewSummaryView: React.FC<InterviewSummaryViewProps> = ({
  session,
  setView,
  setSession,
  saveToHistory,
  userAiKey,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState(session.aiSummary || '');

  const [isEditingTranslated, setIsEditingTranslated] = useState(false);
  const [editedTranslatedSummary, setEditedTranslatedSummary] = useState(session.aiSummaryTranslated || '');

  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleSave = async (overrideSummary?: string, overrideTranslated?: string) => {
    setIsSaving(true);
    const finalSummary = overrideSummary !== undefined ? overrideSummary : editedSummary;
    const finalTranslated = overrideTranslated !== undefined ? overrideTranslated : editedTranslatedSummary;

    const updatedSession = { ...session, aiSummary: finalSummary, aiSummaryTranslated: finalTranslated };
    if (setSession) setSession(updatedSession);
    if (saveToHistory) {
      try {
        await saveToHistory(updatedSession);
      } catch (error) {
        console.error('Failed to save edited summary:', error);
      }
    }
    setIsEditing(false);
    setIsEditingTranslated(false);
    setIsSaving(false);
  };

  const handleTranslate = async () => {
    if (!userAiKey) {
      alert('Brak klucza API do tłumaczenia.');
      return;
    }
    setIsTranslating(true);
    try {
      const translated = await translateSummaryToEnglish(userAiKey, session.aiSummary || '');
      setEditedTranslatedSummary(translated);
      await handleSave(editedSummary, translated);
    } catch (error) {
      console.error(error);
      alert('Wystąpił błąd podczas tłumaczenia podsumowania.');
    } finally {
      setIsTranslating(false);
    }
  };

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

        {session.overallComment && (
          <div className='mb-6'>
            <h3 className='text-xs font-black text-slate-400 uppercase mb-2'>Twoje notatki:</h3>
            <p className='text-slate-600 italic bg-slate-50 p-4 rounded-lg border border-slate-100'>
              {session.overallComment}
            </p>
          </div>
        )}

        <div className='mb-10'>
          <div className='flex justify-between items-center mb-3'>
            <h3 className='text-lg font-bold text-slate-700'>Wygenerowane podsumowanie (PL)</h3>
            {!isEditing ? (
              <div className='flex gap-2'>
                <button
                  onClick={handleTranslate}
                  disabled={isTranslating || !userAiKey}
                  className={`text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                    isTranslating || !userAiKey
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-50 text-indigo-600 hover:text-indigo-800'
                  }`}
                  title={!userAiKey ? 'Brak klucza API Gemini' : 'Przetłumacz na angielski'}
                >
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129'
                    />
                  </svg>
                  {isTranslating ? 'Tłumaczenie...' : 'Przetłumacz na EN'}
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={isTranslating}
                  className={`text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                    isTranslating
                      ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                      : 'text-blue-600 hover:text-blue-800 bg-blue-50'
                  }`}
                >
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                    />
                  </svg>
                  Edytuj
                </button>
              </div>
            ) : (
              <div className='flex items-center gap-2'>
                <button
                  onClick={() => {
                    setEditedSummary(session.aiSummary || '');
                    setIsEditing(false);
                  }}
                  className='text-sm text-slate-500 font-bold hover:text-slate-700 px-3 py-1.5'
                  disabled={isSaving}
                >
                  Anuluj
                </button>
                <button
                  onClick={() => handleSave()}
                  className='text-sm text-white font-bold bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:bg-green-400'
                  disabled={isSaving}
                >
                  {isSaving ? 'Zapisywanie...' : 'Zapisz'}
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <textarea
              className='w-full min-h-[300px] p-6 text-slate-700 bg-white border-2 border-blue-200 focus:border-blue-400 rounded-xl outline-none leading-relaxed shadow-inner'
              value={editedSummary}
              onChange={(e) => setEditedSummary(e.target.value)}
              disabled={isSaving}
            />
          ) : (
            <div className='prose max-w-none text-slate-700 bg-blue-50/50 p-6 rounded-xl border border-blue-100 whitespace-pre-wrap leading-relaxed shadow-inner'>
              {session.aiSummary}
            </div>
          )}
        </div>

        {(session.aiSummaryTranslated || isTranslating) && (
          <div className='mb-10'>
            <div className='flex justify-between items-center mb-3'>
              <h3 className='text-lg font-bold text-slate-700'>Tłumaczenie (EN)</h3>
              {!isEditingTranslated ? (
                <button
                  onClick={() => setIsEditingTranslated(true)}
                  disabled={isTranslating}
                  className={`text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                    isTranslating
                      ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                      : 'text-blue-600 hover:text-blue-800 bg-blue-50'
                  }`}
                >
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
                    />
                  </svg>
                  Edytuj
                </button>
              ) : (
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() => {
                      setEditedTranslatedSummary(session.aiSummaryTranslated || '');
                      setIsEditingTranslated(false);
                    }}
                    className='text-sm text-slate-500 font-bold hover:text-slate-700 px-3 py-1.5'
                    disabled={isSaving}
                  >
                    Anuluj
                  </button>
                  <button
                    onClick={() => handleSave()}
                    className='text-sm text-white font-bold bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:bg-green-400'
                    disabled={isSaving}
                  >
                    {isSaving ? 'Zapisywanie...' : 'Zapisz'}
                  </button>
                </div>
              )}
            </div>

            {isEditingTranslated ? (
              <textarea
                className='w-full min-h-[300px] p-6 text-slate-700 bg-white border-2 border-indigo-200 focus:border-indigo-400 rounded-xl outline-none leading-relaxed shadow-inner'
                value={editedTranslatedSummary}
                onChange={(e) => setEditedTranslatedSummary(e.target.value)}
                disabled={isSaving}
              />
            ) : (
              <div className='prose max-w-none text-slate-700 bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 whitespace-pre-wrap leading-relaxed shadow-inner'>
                {isTranslating ? 'Generowanie tłumaczenia w toku...' : session.aiSummaryTranslated}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setView('START')}
          className='w-full py-4 bg-slate-800 text-white font-bold rounded-xl mt-4'
        >
          Zamknij i Wróć
        </button>
      </div>
    </div>
  );
};
