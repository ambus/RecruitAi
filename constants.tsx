
import { Question } from './types';

export const DEFAULT_CATEGORIES = [
  'JavaScript',
  'TypeScript',
  'Angular',
  'HTML',
  'CSS',
  'Live Coding'
];

export const QUESTIONS: Question[] = [
  // JS
  { id: 'js1', category: 'JavaScript', question: 'Czym jest Event Loop w JavaScript?', correctAnswer: 'Mechanizm zarządzający asynchronicznością, który monitoruje stos wywołań (Call Stack) i kolejkę zadań (Callback Queue).' },
  { id: 'js2', category: 'JavaScript', question: 'Co to jest closure (domknięcie)?', correctAnswer: 'Funkcja mająca dostęp do zmiennych ze swojego zakresu leksykalnego, nawet po tym jak funkcja zewnętrzna zakończyła działanie.' },
  { id: 'js3', category: 'JavaScript', question: 'Różnica między == a ===?', correctAnswer: '== porównuje wartości po dokonaniu niejawnej konwersji typów, === porównuje wartość i typ.' },
  
  // TS
  { id: 'ts1', category: 'TypeScript', question: 'Co to są Generics w TypeScript?', correctAnswer: 'Sposób na tworzenie komponentów wielokrotnego użytku, które pracują z różnymi typami, zachowując przy tym bezpieczeństwo typowania.' },
  { id: 'ts2', category: 'TypeScript', question: 'Różnica między interface a type?', correctAnswer: 'Interface służy głównie do definiowania kształtu obiektów i może być rozszerzany (declaration merging), type jest bardziej wszechstronny (aliasy, unie, tuple).' },
  
  // Angular
  { id: 'ang1', category: 'Angular', question: 'Czym są sygnały (Signals) w Angularze?', correctAnswer: 'Nowy system reaktywności wprowadzony w v16, pozwalający na drobnoziarniste śledzenie zmian stanu bez polegania wyłącznie na Zone.js.' },
  { id: 'ang2', category: 'Angular', question: 'Opisz cykl życia komponentu w Angularze.', correctAnswer: 'Główne hooki: ngOnInit, ngOnChanges, ngDoCheck, ngAfterViewInit, ngOnDestroy.' },
  { id: 'ang3', category: 'Angular', question: 'Co to jest Dependency Injection?', correctAnswer: 'Wzorzec projektowy polegający na wstrzykiwaniu zależności do klasy zamiast tworzenia ich wewnątrz niej. Zwiększa modularność i testowalność.' },
  
  // HTML
  { id: 'html1', category: 'HTML', question: 'Co to jest semantyka w HTML?', correctAnswer: 'Używanie tagów zgodnie z ich znaceniem (np. <nav>, <header>, <article>), co poprawia dostępność i SEO.' },
  
  // CSS
  { id: 'css1', category: 'CSS', question: 'Różnica między Flexbox a Grid?', correctAnswer: 'Flexbox jest jednowymiarowy (wiersz lub kolumna), Grid jest dwuwymiarowy (wiersze i kolumny jednocześnie).' },
  
  // Live Coding
  { id: 'lc1', category: 'Live Coding', question: 'Napisz funkcję odwracającą stringa.', correctAnswer: 'Np. str.split("").reverse().join("") lub pętla for.' },
  { id: 'lc2', category: 'Live Coding', question: 'Zaimplementuj prosty filtr listy obiektów.', correctAnswer: 'Użycie metody .filter() na tablicy.' },
];
