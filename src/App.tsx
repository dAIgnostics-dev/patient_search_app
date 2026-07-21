import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { CardLoginScreen } from './components/CardLoginScreen';
import './App.css';

export default function App() {
  const { session } = useAuth();

  return (
    <div className="app">
      {session ? <AppShell /> : <CardLoginScreen />}
    </div>
  );
}
