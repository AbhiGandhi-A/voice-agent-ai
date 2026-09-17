import React from 'react';
import {
  Home,
  MessageSquare,
  PhoneCall,
  Phone,
  Users,
  Settings,
  Activity,
  Boxes,
  Network,
  HelpCircle,
  Moon,
  Volume2,
} from 'lucide-react';

export type NavTab =
  | 'home'
  | 'conversations'
  | 'calls'
  | 'dialer'
  | 'contacts'
  | 'settings'
  | 'system-status'
  | 'models'
  | 'integrations'
  | 'help';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isDark: boolean;
  onToggleDark: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isDark,
  onToggleDark,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'home' as NavTab, label: 'Home', icon: Home },
    { id: 'conversations' as NavTab, label: 'Conversations', icon: MessageSquare },
    { id: 'calls' as NavTab, label: 'Calls', icon: PhoneCall },
    { id: 'dialer' as NavTab, label: 'Dialer', icon: Phone },
    { id: 'contacts' as NavTab, label: 'Contacts', icon: Users },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
    { id: 'system-status' as NavTab, label: 'System Status', icon: Activity },
    { id: 'models' as NavTab, label: 'Models', icon: Boxes },
    { id: 'integrations' as NavTab, label: 'Integrations', icon: Network },
    { id: 'help' as NavTab, label: 'Help & Docs', icon: HelpCircle },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          id="sidebar-mobile-backdrop"
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}

      <aside
        id="main-sidebar"
        className={`fixed lg:static top-0 left-0 bottom-0 z-50 w-64 bg-[#080d1a]/95 lg:bg-[#070b16] border-r border-slate-800/70 flex flex-col justify-between py-5 px-3.5 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col gap-6">
          {/* Logo / Brand Header */}
          <div
            className="flex items-center gap-3 px-2 cursor-pointer"
            onClick={() => {
              onSelectTab('home');
              onCloseMobile?.();
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-[0_0_18px_rgba(99,102,241,0.4)] text-white shrink-0">
              <Volume2 className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-[17px] font-bold tracking-tight text-white flex items-center gap-1.5">
                AI Voice Agent
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Your Personal AI Assistant</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile?.();
                  }}
                  className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-[13.5px] transition-all duration-200 text-left w-full group relative ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-[0_2px_14px_rgba(99,102,241,0.35)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_#fff]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Theme toggle & Profile */}
        <div className="flex flex-col gap-4 pt-4 border-t border-slate-800/80">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/40 border border-slate-800/50">
            <div className="flex items-center gap-2.5 text-slate-400 text-xs font-medium">
              <Moon className="w-4 h-4 text-slate-400" />
              <span>Dark Mode</span>
            </div>
            <button
              id="theme-toggle-btn"
              onClick={onToggleDark}
              type="button"
              aria-label="Toggle dark mode"
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                isDark ? 'bg-indigo-600 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-semibold text-xs flex items-center justify-center shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                U
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200 leading-tight">User</span>
                <span className="text-[10px] text-slate-400 font-medium">Free Plan • Local AI</span>
              </div>
            </div>
            <button
              id="user-settings-quick-btn"
              onClick={() => onSelectTab('settings')}
              title="Settings"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
