import { GoogleGenAI, Type } from '@google/genai';
import { InterviewSession, Question } from '../types';

export async function generateInterviewSummary(session: InterviewSession, allQuestions: Question[]): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  const scoredData = session.scores.map((s) => {
    const q = allQuestions.find((q) => q.id === s.questionId);
    return {
      category: q?.category || 'Inne',
      question: q?.question || 'Pytanie usunięte',
      rating: s.rating,
    };
  });

  const usedCategories = Array.from(new Set(scoredData.map((d) => d.category)));

  const prompt = `
    Działaj jako senior tech lead. Przeprowadziłeś rozmowę techniczną z kandydatem o imieniu ${session.candidate.name}.
    Poniżej znajdują się wyniki z podziałem na pytania i oceny (w skali 1-5):
    ${JSON.stringify(scoredData, null, 2)}

    Przygotuj profesjonalne podsumowanie rozmowy w języku polskim.
    Podsumowanie musi zawierać:
    1. Krótką ocenę ogólną.
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
    return 'Wystąpił błąd podczas generowania podsumowania przez AI.';
  }
}

export async function generateNewQuestions(
  category: string,
  topic: string,
  count: number,
): Promise<Partial<Question>[]> {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  const prompt = `Wygeneruj ${count} pytań rekrutacyjnych wraz z prawidłowymi odpowiedziami dla kategorii "${category}". 
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

    console.log(response.text);
    return JSON.parse(response.text);
  } catch (error) {
    console.error('AI Question Generation Error:', error);
    throw new Error('Nie udało się wygenerować pytań przez AI.');
  }
}
