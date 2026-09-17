import React, { useState } from 'react';
import { Search, MessageSquare, Trash2, Calendar, Clock, Volume2, ArrowLeft } from 'lucide-react';
import { Conversation } from '../types';
import { LiveTranscript } from './LiveTranscript';

interface ConversationsViewProps {
  conversations: Conversation[];
  onDeleteConversation: (id: string) => void;
  onPlayMessage?: (text: string) => void;
}

export const ConversationsView: React.FC<ConversationsViewProps> = ({
  conversations,
  onDeleteConversation,
  onPlayMessage,
}) => {
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'web' | 'phone'>('all');

  const filtered = conversations.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.messages.some((m) => m.content.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' ? true : c.type === filterType;
    return matchesSearch && matchesType;
  });

  if (selectedConv) {
    return (
      <div className="flex flex-col gap-5 p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <button
            onClick={() => setSelectedConv(null)}
            className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Conversations</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono">{selectedConv.dateLabel}</span>
            <button
              onClick={() => {
                onDeleteConversation(selectedConv.id);
                setSelectedConv(null);
              }}
              className="p-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
              title="Delete conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-white">{selectedConv.title}</h2>
          {selectedConv.summary && (
            <p className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <strong className="text-indigo-300">Summary: </strong> {selectedConv.summary}
            </p>
          )}
        </div>

        <div className="mt-2">
          <LiveTranscript messages={selectedConv.messages} onPlayMessage={onPlayMessage} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Conversations History</h2>
          <p className="text-xs text-slate-400 mt-1">
            Browse and review previous voice chats, transcripts, and audio metadata.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 border border-slate-800 rounded-xl">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
              filterType === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('web')}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
              filterType === 'web' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Web Voice
          </button>
          <button
            onClick={() => setFilterType('phone')}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
              filterType === 'phone' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Phone Calls
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search conversation topics or transcript text..."
          className="w-full pl-10 pr-4 py-2.5 bg-[#0c1222]/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* List of Conversations */}
      {filtered.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0c1222]/60 border border-slate-800 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No Conversations Found</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {searchTerm
              ? 'No conversations match your search filter.'
              : 'You have not started any voice conversations yet. Speak with the microphone or send a message on the Home dashboard to begin.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((conv) => (
            <div
              key={conv.id}
              id={`conv-card-${conv.id}`}
              onClick={() => setSelectedConv(conv)}
              className="p-5 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 hover:border-indigo-500/50 transition-all cursor-pointer flex flex-col justify-between gap-4 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-indigo-200 transition-colors">
                      {conv.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {conv.dateLabel}
                      </span>
                      {conv.duration && (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {conv.duration}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-slate-900 border border-slate-800 text-slate-400 font-medium">
                  {conv.messageCount} msgs
                </span>
              </div>

              {/* Preview text */}
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {conv.messages[conv.messages.length - 1]?.content || 'Empty conversation'}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 text-[11px] text-slate-400">
                <span className="text-indigo-400 font-medium group-hover:underline">Open transcript →</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  className="text-slate-500 hover:text-rose-400 p-1"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
