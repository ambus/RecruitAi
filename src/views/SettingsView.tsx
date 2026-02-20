import React from 'react';

interface SettingsViewProps {
  userAiKey: string;
  setUserAiKey: (key: string) => void;
  setView: (view: any) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ userAiKey, setUserAiKey, setView }) => {
  const handleSaveAiKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gemini_api_key', userAiKey);
    alert('Klucz API został zapisany lokalnie.');
    setView('START');
  };

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
};
