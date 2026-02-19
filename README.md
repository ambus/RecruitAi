# RecruitAI - Techniczny Panel Rekrutacyjny

Profesjonalne narzędzie do przeprowadzania technicznych rozmów kwalifikacyjnych, oceny kandydatów i automatycznego generowania podsumowań z wykorzystaniem AI (Google Gemini).

## 🚀 Szybki Start (Lokalnie)

1.  Zainstaluj zależności:
    ```bash
    npm install
    ```
2.  Utwórz plik `.env` w głównym katalogu projektu (zobacz sekcję Konfiguracja).
3.  Uruchom aplikację w trybie deweloperskim:
    ```bash
    npm run dev
    ```

## ⚙️ Konfiguracja Firebase

Aplikacja opiera się na usługach Firebase (Authentication, Firestore, Hosting). Aby ją wdrożyć, wykonaj poniższe kroki:

### 1. Tworzenie Projektu

- Przejdź do [Firebase Console](https://console.firebase.google.com/) i utwórz nowy projekt.
- Dodaj aplikację Web (Web App) do projektu.

### 2. Authentication

- W sekcji **Authentication > Sign-in method** włącz dostawcę **Google**.

### 3. Cloud Firestore (Baza danych)

- Włącz usługę Firestore w trybie produkcyjnym lub testowym.
- **Ważne (Autoryzacja):** Aplikacja posiada wbudowany mechanizm sprawdzania uprawnień. Aby zalogowany użytkownik mógł korzystać z systemu, jego UID musi znajdować się w kolekcji `users`:
  1. Zaloguj się do aplikacji (zobaczysz ekran "Brak Uprawnień" wraz ze swoim UID).
  2. W konsoli Firebase przejdź do Firestore.
  3. Utwórz kolekcję o nazwie `users`.
  4. Dodaj dokument, którego **ID dokumentu to Twój UID**. Pola mogą być dowolne (np. `name: "Twoje Imię"`).

### 4. Hosting

- Włącz usługę Hosting w konsoli projektu.

## 🔑 Zmienne Środowiskowe (.env)

Skopiuj dane konfiguracyjne ze swojej konsoli Firebase (Ustawienia projektu > Twoje aplikacje) i utwórz plik `.env`:

```env
VITE_FIREBASE_API_KEY=twoj_klucz_api
VITE_FIREBASE_AUTH_DOMAIN=twoj-projekt.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=twoj-projekt
VITE_FIREBASE_STORAGE_BUCKET=twoj-projekt.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=id_nadawcy
VITE_FIREBASE_APP_ID=id_aplikacji
```

## 📦 Wdrażanie (Deployment)

### Ręczne (Firebase CLI)

1. Zainstaluj Firebase Tools: `npm install -g firebase-tools`.
2. Zaloguj się: `firebase login`.
3. Wybierz projekt: `firebase use --add [PROJECT_ID]`.
4. Zbuduj projekt: `npm run build`.
5. Wdróż: `firebase deploy`.

### Automatyczne (GitHub Actions)

Projekt zawiera gotowe pliki workflow w `.github/workflows/`. Aby automatyczne wdrażanie działało:

1. W ustawieniach repozytorium na GitHubie (**Settings > Secrets and variables > Actions**) dodaj powyższe zmienne `VITE_FIREBASE_*` jako **Secrets**.
2. Dodaj `FIREBASE_SERVICE_ACCOUNT_RECRUITAI_4FDE9` (uzyskasz go podczas inicjalizacji `firebase init hosting:github` lub z konsoli Google Cloud jako klucz konta serwisowego).

## 🤖 Klucz API Gemini

Aplikacja wymaga klucza API Gemini do generowania pytań oraz podsumowań.

1. Pobierz klucz na stronie [Google AI Studio](https://aistudio.google.com/).
2. Po zalogowaniu do RecruitAI, wejdź w **Ustawienia** (ikona koła zębatego w prawym górnym rogu) i wklej swój klucz. Jest on zapisywany lokalnie w Twojej przeglądarce (`localStorage`).

## 🛠️ Technologie

- **React 19** + **TypeScript**
- **Vite** (Bundler & Dev Server)
- **Tailwind CSS** (UI Framework)
- **Firebase** (Baza danych, Logowanie, Hosting)
- **Google Gemini API** (Silnik AI)
