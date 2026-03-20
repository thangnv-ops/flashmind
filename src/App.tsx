import { useState } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { SetEditor } from './pages/SetEditor';
import { FlashcardView } from './pages/FlashcardView';
import { MatchGame } from './pages/MatchGame';

type Page = 'dashboard' | 'editor' | 'flashcards' | 'match';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const navigateTo = (page: Page, setId: string | null = null) => {
    setCurrentPage(page);
    setSelectedSetId(setId);
    window.scrollTo(0, 0);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1 bg-bg-light">
              <Dashboard 
                onCreateSet={() => navigateTo('editor')}
                onSelectSet={(id) => navigateTo('flashcards', id)}
                onPlayMatch={(id) => navigateTo('match', id)}
              />
            </main>
          </div>
        );
      case 'editor':
        return <SetEditor onBack={() => navigateTo('dashboard')} />;
      case 'flashcards':
        return <FlashcardView setId={selectedSetId!} onBack={() => navigateTo('dashboard')} />;
      case 'match':
        return <MatchGame setId={selectedSetId!} onBack={() => navigateTo('dashboard')} />;
      default:
        return <Dashboard onCreateSet={() => navigateTo('editor')} onSelectSet={(id) => navigateTo('flashcards', id)} onPlayMatch={(id) => navigateTo('match', id)} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {currentPage === 'dashboard' && <Navbar onCreate={() => navigateTo('editor')} />}
      {renderPage()}
    </div>
  );
}


