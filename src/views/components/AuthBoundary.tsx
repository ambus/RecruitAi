import React from 'react';
import { useAuth } from '../../hooks/useAuth';

interface AuthBoundaryProps {
  children: (auth: ReturnType<typeof useAuth>) => React.ReactNode;
}

export const AuthBoundary: React.FC<AuthBoundaryProps> = ({ children }) => {
  const auth = useAuth();
  const { user, isAuthorized, authLoading, handleLogin, handleLogout } = auth;

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

  return <>{children(auth)}</>;
};
