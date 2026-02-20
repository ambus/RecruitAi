import React from 'react';
import { InterviewSession } from '../../types';
import { calculateTotalAverage } from '../utils/helpers';

interface HistoryViewProps {
  history: InterviewSession[];
  setView: (view: any) => void;
  setSession: (s: InterviewSession) => void;
  deleteFromHistory: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, setView, setSession, deleteFromHistory }) => {
  return (
    <div className='min-h-screen p-6 md:p-12 max-w-4xl mx-auto'>
      <header className='flex justify-between items-center mb-8'>
        <h1 className='text-3xl font-bold text-slate-800'>Historia</h1>
        <button onClick={() => setView('START')} className='px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg'>
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
              <div className='flex items-center gap-4'>
                <div className='text-xl font-black text-slate-700'>{calculateTotalAverage(h).toFixed(1)}/5</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Czy na pewno chcesz usunąć tę rozmowę z historii?')) {
                      if (h.id) deleteFromHistory(h.id);
                    }
                  }}
                  className='p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors'
                  title='Usuń z historii'
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
          ))
        ) : (
          <p className='text-center text-slate-500 py-10'>Nie masz jeszcze zapisanych żadnych rozmów.</p>
        )}
      </div>
    </div>
  );
};
