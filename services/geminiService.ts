import { GoogleGenAI, Type } from '@google/genai';
import { Difficulty, InterviewSession, Question } from '../types';

export async function generateInterviewSummary(
  apiKey: string,
  session: InterviewSession,
  allQuestions: Question[],
): Promise<string> {
  if (!apiKey) throw new Error('Brak klucza API Gemini');
  const ai = new GoogleGenAI({ apiKey });

  const scoredData = session.scores.map((s) => {
    const q = allQuestions.find((q) => q.id === s.questionId);
    return {
      category: q?.category || 'Inne',
      question: q?.question || 'Pytanie usunięte',
      rating: s.rating,
      difficulty: q?.difficulty || 'Niekreślony',
    };
  });

  const usedCategories = Array.from(new Set(scoredData.map((d) => d.category)));

  const prompt = `
    Działaj jako senior tech lead. Przeprowadziłeś rozmowę techniczną z kandydatem o imieniu ${session.candidate.name}.
    Poniżej znajdują się wyniki z podziałem na pytania, ich poziom trudności i oceny (w skali 1-5):
    ${JSON.stringify(scoredData, null, 2)}

    Przygotuj profesjonalne podsumowanie rozmowy w języku polskim.
    Podsumowanie musi zawierać:
    1. Krótką ocenę ogólną (uwzględniając poziomy trudności pytań).
    2. Szczegółową analizę dla każdej z ocenianych kategorii: ${usedCategories.join(', ')}.
    3. Rekomendację (Zatrudnić / Nie zatrudnić / Kolejny etap).
    4. Główne mocne strony i obszary do poprawy.

    Formatuj odpowiedź w Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || 'Nie udało się wygenerować podsumowania.';
  } catch (error) {
    console.error('Gemini Error:', error);
    return 'Wystąpił błąd podczas generowania podsumowania przez AI. Sprawdź poprawność klucza API w ustawieniach.';
  }
}

export async function generateNewQuestions(
  apiKey: string,
  category: string,
  topic: string,
  count: number,
  difficulty: Difficulty,
): Promise<Partial<Question>[]> {
  if (!apiKey) throw new Error('Brak klucza API Gemini');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Wygeneruj ${count} pytań rekrutacyjnych wraz z prawidwolymi odpowiedziami dla kategorii "${category}". 
  Poziom trudności: ${difficulty}.
  Temat przewodni: ${topic || 'ogólna wiedza techniczna'}.
  Wszystkie pytania i odpowiedzi muszą być w języku POLSKIM.
  Zwróć wynik jako tablicę obiektów JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: 'Treść pytania rekrutacyjnego' },
              correctAnswer: { type: Type.STRING, description: 'Modelowa prawidłowa odpowiedź' },
            },
            required: ['question', 'correctAnswer'],
          },
        },
      },
    });

    const parsed = JSON.parse(response.text);
    return parsed.map((q: any) => ({ ...q, difficulty }));
  } catch (error) {
    console.error('AI Question Generation Error:', error);
    throw new Error('Nie udało się wygenerować pytań przez AI. Sprawdź poprawność klucza API w ustawieniach.');
  }
}

export async function generateCategorySuggestions(apiKey: string, techStack: string): Promise<string[]> {
  if (!apiKey) throw new Error('Brak klucza API Gemini');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Zaproponuj listę 5-8 konkretnych kategorii technicznych (obszarów wiedzy) do sprawdzenia na rozmowie rekrutacyjnej dla stanowiska/stacku: "${techStack}". 
  Przykłady dla "React": React Hooks, State Management, CSS-in-JS, Performance. 
  Zwróć wyłącznie tablicę JSON z nazwami kategorii w języku polskim lub angielskim (zależnie od standardu branżowego).`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error('AI Category Suggestion Error:', error);
    throw new Error('Nie udało się wygenerować sugestii kategorii.');
  }
}
