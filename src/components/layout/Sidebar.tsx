import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, 
  Library, 
  Clock, 
  Folder as FolderIcon, 
  ChevronDown, 
  ChevronRight,
  Settings,
  HelpCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { MOCK_FOLDERS } from '../../mockData';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const [isFoldersOpen, setIsFoldersOpen] = useState(true);

  const navItems = [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: Library, label: 'Your Library', path: '/dashboard' },
    { icon: Clock, label: 'Recent', path: '/dashboard' },
  ];

  return (
    <aside className="w-64 border-r bg-white h-[calc(100vh-64px)] sticky top-16 hidden lg:flex flex-col p-4">
      <div className="space-y-1 mb-8">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              item.label === 'Home'
                ? "bg-primary/10 text-primary" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1">
        <button 
          onClick={() => setIsFoldersOpen(!isFoldersOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
        >
          <span>Folders</span>
          {isFoldersOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        
        {isFoldersOpen && (
          <div className="mt-1 space-y-1">
            {MOCK_FOLDERS.map((folder) => (
              <button
                key={folder.id}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <FolderIcon className="w-4 h-4 text-slate-400" />
                {folder.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <HelpCircle className="w-4 h-4" />
          Help Center
        </button>
      </div>
    </aside>
  );
};
