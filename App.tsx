import React, { useState } from 'react';
import { useAuth } from './src/hooks/useAuth';
import { useFirebaseData } from './src/hooks/useFirebaseData';
import { CandidateView } from './src/views/CandidateView';
import { AuthBoundary } from './src/views/components/AuthBoundary';
import { HistoryView } from './src/views/HistoryView';
import { InterviewSessionView } from './src/views/InterviewFlow/InterviewSession';
import { InterviewSummaryView } from './src/views/InterviewFlow/InterviewSummary';
import { QuestionsMgmtView } from './src/views/QuestionsMgmtView';
import { SettingsView } from './src/views/SettingsView';
import { StartView } from './src/views/StartView';
import { Candidate, InterviewSession } from './types';

export type View = 'START' | 'FORM' | 'INTERVIEW' | 'HISTORY' | 'SUMMARY' | 'QUESTIONS_MGMT' | 'SETTINGS';

const App: React.FC = () => {
  const [view, setView] = useState<View>('START');
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [userAiKey, setUserAiKey] = useState<string>(localStorage.getItem('gemini_api_key') || '');

  const auth = useAuth();
  const firebaseData = useFirebaseData(auth.user?.uid, auth.isAuthorized);

  const handleStartInterview = (candidate: Candidate) => {
    setSession({ candidate, scores: [], isCompleted: false, overallComment: '', createdBy: auth.user?.uid });
    setView('INTERVIEW');
  };

  return (
    <AuthBoundary>
      {({ user, handleLogout }) => {
        if (view === 'START') {
          return <StartView user={user!} userAiKey={userAiKey} setView={setView} handleLogout={handleLogout} />;
        }

        if (view === 'SETTINGS') {
          return <SettingsView userAiKey={userAiKey} setUserAiKey={setUserAiKey} setView={setView} />;
        }

        if (view === 'QUESTIONS_MGMT') {
          return (
            <QuestionsMgmtView
              categories={firebaseData.categories}
              questions={firebaseData.questions}
              userAiKey={userAiKey}
              setView={setView}
              handleAddCategory={firebaseData.handleAddCategory}
              handleUpdateCategoriesList={firebaseData.handleUpdateCategoriesList}
              handleDeleteCategory={firebaseData.handleDeleteCategory}
              handleUpdateCategory={firebaseData.handleUpdateCategory}
              handleSaveQuestion={firebaseData.handleSaveQuestion}
              handleDeleteQuestion={firebaseData.handleDeleteQuestion}
              handleSaveMultipleQuestions={firebaseData.handleSaveMultipleQuestions}
            />
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
              <CandidateView onStart={handleStartInterview} />
            </div>
          );
        }

        if (view === 'HISTORY') {
          return (
            <HistoryView
              history={firebaseData.history}
              setView={setView}
              setSession={setSession}
              deleteFromHistory={firebaseData.deleteFromHistory}
            />
          );
        }

        if (view === 'INTERVIEW' && session) {
          return (
            <InterviewSessionView
              session={session}
              setSession={setSession}
              questions={firebaseData.questions}
              categories={firebaseData.categories}
              userAiKey={userAiKey}
              userUid={auth.user?.uid}
              setView={setView}
              saveToHistory={firebaseData.saveToHistory}
            />
          );
        }

        if (view === 'SUMMARY' && session) {
          return <InterviewSummaryView session={session} setView={setView} />;
        }

        return null;
      }}
    </AuthBoundary>
  );
};

export default App;
