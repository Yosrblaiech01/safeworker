import { Navigate, Routes, Route } from 'react-router-dom';
import { isSupabaseConfigured } from './lib/supabase';
import { AuthProvider } from './context/AuthContext';
import { SelectedWorkerProvider } from './context/SelectedWorkerContext';
import { ThemeProvider } from './context/ThemeContext';
import { ThresholdsProvider } from './context/ThresholdsContext';
import ProtectedRoute from './components/ProtectedRoute';
import SetupRequired from './components/SetupRequired';
import Home from './pages/Home';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Workers from './pages/Workers';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import Alerts from './pages/Alerts';

function Protected({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <SetupRequired />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <ThresholdsProvider>
          <SelectedWorkerProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />

              <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
              <Route path="/workers" element={<Protected><Workers /></Protected>} />
              <Route path="/alerts" element={<Protected><Alerts /></Protected>} />
              <Route path="/reports" element={<Protected><Reports /></Protected>} />
              <Route path="/settings" element={<Protected><Settings /></Protected>} />

              {/* Ancienne adresse du projet football */}
              <Route path="/players" element={<Navigate to="/workers" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SelectedWorkerProvider>
        </ThresholdsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
