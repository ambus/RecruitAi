import React from 'react';
import { View } from '../../App';
import { InterviewSession } from '../../types';
import { calculateTotalAverage } from '../../utils/helpers';

interface InterviewSummaryViewProps {
  session: InterviewSession;
  setView: (view: View) => void;
}

export const InterviewSummaryView: React.FC<InterviewSummaryViewProps> = ({ session, setView }) => {
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

        <div className='prose max-w-none text-slate-700 bg-blue-50/50 p-6 rounded-xl border border-blue-100 whitespace-pre-wrap leading-relaxed shadow-inner mb-10'>
          {session.aiSummary}
        </div>
        <button onClick={() => setView('START')} className='w-full py-4 bg-slate-800 text-white font-bold rounded-xl'>
          Zamknij i Wróć
        </button>
      </div>
    </div>
  );
};
