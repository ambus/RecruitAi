import React from 'react';
import { User } from '../../services/firebase';

interface StartViewProps {
  user: User;
  userAiKey: string;
  setView: (view: any) => void;
  handleLogout: () => void;
}

export const StartView: React.FC<StartViewProps> = ({ user, userAiKey, setView, handleLogout }) => {
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
};
