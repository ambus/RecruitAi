import { useEffect, useState } from 'react';
import { DEFAULT_CATEGORIES, QUESTIONS as INITIAL_QUESTIONS } from '../../constants';
import {
  addDoc,
  collection,
  db,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from '../../services/firebase';
import { InterviewSession, Question } from '../../types';

export function useFirebaseData(userUid: string | undefined, isAuthorized: boolean | null) {
  const [history, setHistory] = useState<InterviewSession[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!userUid || !isAuthorized) return;

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
        const isVisible = !data.isPrivate || data.createdBy === userUid || !data.createdBy;
        if (isVisible) {
          qs.push({ id: d.id, ...data });
        }
      });
      setQuestions(qs.length > 0 ? qs : INITIAL_QUESTIONS);
    });

    const hQuery = query(
      collection(db, 'interviews'),
      where('createdBy', '==', userUid),
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
  }, [userUid, isAuthorized]);

  const saveToHistory = async (completedSession: InterviewSession) => {
    try {
      await addDoc(collection(db, 'interviews'), {
        ...completedSession,
        createdBy: userUid,
      });
    } catch (error) {
      console.error('Failed to save history to Firebase', error);
    }
  };

  const handleAddCategory = async (newCategoryName: string) => {
    if (!newCategoryName || categories.includes(newCategoryName)) return;
    const newList = [...categories, newCategoryName];
    await setDoc(doc(db, 'settings', 'categories'), { list: newList });
  };

  const handleUpdateCategoriesList = async (newList: string[]) => {
    await setDoc(doc(db, 'settings', 'categories'), { list: newList });
  };

  const handleDeleteCategory = async (cat: string) => {
    const newList = categories.filter((c) => c !== cat);
    await setDoc(doc(db, 'settings', 'categories'), { list: newList });
  };

  const handleUpdateCategory = async (oldName: string, newName: string) => {
    const newList = categories.map((c) => (c === oldName ? newName : c));
    await setDoc(doc(db, 'settings', 'categories'), { list: newList });

    const toUpdate = questions.filter((q) => q.category === oldName);
    for (const q of toUpdate) {
      if (q.id) {
        await updateDoc(doc(db, 'questions', q.id), { category: newName });
      }
    }
  };

  const handleSaveQuestion = async (editingQuestion: Partial<Question>) => {
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
        createdBy: userUid,
        isPrivate: !!editingQuestion.isPrivate,
        difficulty,
      });
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    await deleteDoc(doc(db, 'questions', id));
  };

  const handleSaveMultipleQuestions = async (
    questionsToSave: Partial<Question>[],
    category: string,
    difficulty: string,
  ) => {
    for (const q of questionsToSave) {
      await addDoc(collection(db, 'questions'), {
        ...q,
        category,
        createdBy: userUid,
        isPrivate: false,
        difficulty,
      });
    }
  };

  return {
    history,
    questions,
    categories,
    saveToHistory,
    handleAddCategory,
    handleUpdateCategoriesList,
    handleDeleteCategory,
    handleUpdateCategory,
    handleSaveQuestion,
    handleDeleteQuestion,
    handleSaveMultipleQuestions,
  };
}
