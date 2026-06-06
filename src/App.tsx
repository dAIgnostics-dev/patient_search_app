import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { LoginForm } from './components/LoginForm';
import './App.css';

export default function App() {
  const { session } = useAuth();

  return (
    <div className="app">
      {session ? <AppShell /> : <LoginForm />}
    </div>
  );
}
