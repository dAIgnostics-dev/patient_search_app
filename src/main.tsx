import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext';
import { LocaleProvider } from './i18n/LocaleContext';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LocaleProvider>
  </StrictMode>,
);
