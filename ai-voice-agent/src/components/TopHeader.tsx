import React, { useState } from 'react';
import { ChevronDown, Menu, Check } from 'lucide-react';

interface TopHeaderProps {
  connectionStatus: 'Connected' | 'Connecting' | 'Disconnected' | 'Error';
  onChangeConnectionStatus?: (status: 'Connected' | 'Connecting' | 'Disconnected' | 'Error') => void;
  onOpenMobileMenu?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  connectionStatus,
  onChangeConnectionStatus,
  onOpenMobileMenu,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const statuses: Array<'Connected' | 'Connecting' | 'Disconnected' | 'Error'> = [
    'Connected',
    'Connecting',
    'Disconnected',
    'Error',
  ];

  const getStatusDotClass = (st: string) => {
    switch (st) {
      case 'Connected':
        return 'bg-emerald-400 shadow-[0_0_8px_#34d399]';
      case 'Connecting':
        return 'bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse';
      case 'Error':
        return 'bg-rose-500 shadow-[0_0_8px_#f43f5e]';
      default:
        return 'bg-slate-500';
    }
  };

  return (
    <header className="h-16 px-6 border-b border-slate-800/70 bg-[#070b16]/70 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-30">
      {/* Left: Tagline / Mobile Toggle */}
      <div className="flex items-center gap-3">
        <button
          id="mobile-nav-toggle"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-slate-400 text-[13.5px] font-normal tracking-normal hidden sm:inline-block">
          Talk. Ask. Get things done.
        </span>
      </div>

      {/* Right: Connection Status & Date/Time */}
      <div className="flex items-center gap-4 text-xs font-medium">
        {/* Connection status dropdown pill */}
        <div className="relative">
          <button
            id="connection-status-pill"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800/90 text-slate-200 hover:border-slate-700 transition-all cursor-pointer shadow-sm"
          >
            <span className={`w-2 h-2 rounded-full ${getStatusDotClass(connectionStatus)}`} />
            <span className="text-xs font-medium">{connectionStatus}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div
              id="connection-dropdown-menu"
              className="absolute right-0 mt-2 w-44 rounded-xl bg-slate-900 border border-slate-800 shadow-xl py-1.5 z-50 backdrop-blur-xl"
            >
              <div className="px-3 py-1 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Network Status
              </div>
              {statuses.map((st) => (
                <button
                  key={st}
                  id={`status-opt-${st.toLowerCase()}`}
                  onClick={() => {
                    onChangeConnectionStatus?.(st);
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-left text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getStatusDotClass(st)}`} />
                    <span>{st}</span>
                  </div>
                  {connectionStatus === st && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date / Time */}
        <div className="text-slate-400 text-xs hidden md:flex items-center gap-2.5 pl-2 border-l border-slate-800/70 font-mono tracking-tight">
          <span>Wed, 17 Sep 2025</span>
          <span className="text-slate-500">•</span>
          <span>10:24 AM</span>
        </div>
      </div>
    </header>
  );
};
