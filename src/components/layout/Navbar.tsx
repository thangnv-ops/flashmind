import React from 'react';
import { Search, Plus, Bell, User } from 'lucide-react';

interface NavbarProps {
  onCreate: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onCreate }) => {
  return (
    <nav className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-8 flex-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-primary">FlashMind</span>
        </div>
        
        <div className="relative max-w-md w-full hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search your sets, folders..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-primary/20 rounded-full text-sm transition-all outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={onCreate}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create</span>
        </button>
        
        <div className="w-px h-6 bg-slate-200 mx-2" />
        
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        
        <button className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:ring-2 hover:ring-primary/20 transition-all">
          <User className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
};

