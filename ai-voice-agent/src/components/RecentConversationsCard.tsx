import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Conversation } from '../types';

interface RecentConversationsCardProps {
  conversations: Conversation[];
  onSelectConversation: (conv: Conversation) => void;
  onViewAll: () => void;
}

export const RecentConversationsCard: React.FC<RecentConversationsCardProps> = ({
  conversations,
  onSelectConversation,
  onViewAll,
}) => {
  return (
    <div
      id="recent-conversations-card"
      className="rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 p-4 backdrop-blur-xl shadow-lg flex flex-col gap-3.5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white tracking-tight">Recent Conversations</h3>
        <button
          id="recent-conv-view-all-btn"
          onClick={onViewAll}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium cursor-pointer"
        >
          View All
        </button>
      </div>

      <div className="flex flex-col gap-1 divide-y divide-slate-800/50">
        {conversations.length === 0 ? (
          <div className="py-6 px-3 text-center flex flex-col items-center justify-center gap-1.5 text-slate-500">
            <MessageSquare className="w-5 h-5 text-slate-600" />
            <span className="text-xs font-medium text-slate-400">No conversations yet</span>
            <span className="text-[11px] text-slate-500">Speak or send a message to start</span>
          </div>
        ) : (
          conversations.slice(0, 4).map((conv) => (
            <div
              key={conv.id}
              id={`recent-item-${conv.id}`}
              onClick={() => onSelectConversation(conv)}
              className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-slate-800/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 group-hover:border-indigo-500/40 transition-colors shrink-0">
                  <MessageSquare className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors">
                    {conv.title}
                  </span>
                  <span className="text-[10.5px] text-slate-400">{conv.dateLabel}</span>
                </div>
              </div>

              <span className="text-[11px] text-slate-400 font-medium shrink-0">
                {conv.messageCount} messages
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
