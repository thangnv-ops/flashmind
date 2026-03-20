import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudySetCard } from '../components/dashboard/StudySetCard';
import { MOCK_SETS } from '../mockData';
import { Plus, Clock, Filter } from 'lucide-react';
import { StudySetCardSkeleton } from '../components/ui/Skeleton';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome back!</h1>
          <p className="text-slate-500">Ready to master something new today?</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button 
            onClick={() => navigate('/editor')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Set
          </button>
        </div>
      </header>

      <section className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-slate-800">Recent Activity</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => <StudySetCardSkeleton key={i} />)
          ) : (
            <>
              {MOCK_SETS.map((set) => (
                <StudySetCard 
                  key={set.id} 
                  set={set} 
                  onClick={(id) => navigate(`/flashcards/${id}`)} 
                  onPlayMatch={(id) => navigate(`/match/${id}`)}
                />
              ))}
              
              <button 
                onClick={() => navigate('/editor')}
                className="border-2 border-dashed border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-primary/40 hover:text-primary transition-all group min-h-[180px]"
              >
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Plus className="w-6 h-6" />
                </div>
                <span className="font-semibold text-sm">Create new study set</span>
              </button>
            </>
          )}
        </div>
      </section>



      <section>
        <div className="flex items-center gap-2 mb-6">
          <div className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center">
            <div className="w-2 h-2 bg-primary rounded-full" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Your Folders</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="bg-white border rounded-xl p-4 hover:border-primary/40 transition-all cursor-pointer flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-800">New Folder</h4>
              <p className="text-xs text-slate-400">Organize your sets</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
