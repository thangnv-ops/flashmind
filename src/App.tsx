import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { SetEditor } from './pages/SetEditor';
import { FlashcardView } from './pages/FlashcardView';
import { MatchGame } from './pages/MatchGame';
import { LearnMode } from './pages/LearnMode';
import { WriteMode } from './pages/WriteMode';
import { SetOverview } from './pages/SetOverview';
import { AuthPage } from './pages/AuthPage';
import { WordScramble } from './pages/WordScramble';
import { WordBuilder } from './pages/WordBuilder';

// Banner shown when running without a real Supabase project
function DemoBanner() {
  const { isMockMode } = useAuth();
  if (!isMockMode) return null;
  return (
    <div className="bg-amber-400 text-amber-900 text-xs font-semibold text-center py-1.5 px-4">
      ⚠️ Demo Mode — data is not saved.
      Copy <code className="bg-amber-300 px-1 rounded">.env.local.example</code> → <code className="bg-amber-300 px-1 rounded">.env.local</code> and connect Supabase to enable full features.
    </div>
  );
}

// Layout for dashboard: includes Navbar + Sidebar
function DashboardLayout() {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <DemoBanner />
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 bg-bg-light">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Dashboard — protected, with Navbar + Sidebar layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Route>

        {/* Full-screen protected routes (no Navbar/Sidebar) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/editor" element={<SetEditor />} />
          <Route path="/editor/:setId" element={<SetEditor />} />
          <Route path="/sets/:setId" element={<SetOverview />} />
          <Route path="/flashcards/:setId" element={<FlashcardView />} />
          <Route path="/learn/:setId" element={<LearnMode />} />
          <Route path="/write/:setId" element={<WriteMode />} />
          <Route path="/match/:setId" element={<MatchGame />} />
          <Route path="/scramble/:setId" element={<WordScramble />} />
          <Route path="/builder/:setId" element={<WordBuilder />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}


