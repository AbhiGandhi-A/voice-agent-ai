import React, { useState } from 'react';
import { User, Volume2, Copy, Check, Sparkles, Wrench } from 'lucide-react';
import { Message } from '../types';

interface LiveTranscriptProps {
  messages: Message[];
  onPlayMessage?: (text: string) => void;
  liveInterimText?: string;
  isThinking?: boolean;
}

export const LiveTranscript: React.FC<LiveTranscriptProps> = ({
  messages,
  onPlayMessage,
  liveInterimText,
  isThinking,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div id="live-conversation-container" className="flex flex-col gap-4">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        return (
          <div
            key={msg.id}
            id={`message-bubble-${msg.id}`}
            className="flex flex-col gap-1.5 transition-all duration-200"
          >
            {/* Header: Avatar, Name, Timestamp, Copy & Play icons */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                {isUser ? (
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(37,99,235,0.4)]">
                    <User className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                    <Volume2 className="w-3.5 h-3.5" />
                  </div>
                )}
                <span className="text-xs font-semibold text-white">
                  {isUser ? 'You' : 'AI Assistant'}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {msg.timestamp}
                </span>
              </div>

              {/* Action buttons: Copy & Speak */}
              <div className="flex items-center gap-2 text-slate-400">
                <button
                  onClick={() => handleCopy(msg.id, msg.content)}
                  className="p-1 hover:text-slate-200 transition-colors rounded hover:bg-slate-800/40"
                  title="Copy message"
                >
                  {copiedId === msg.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => onPlayMessage?.(msg.content)}
                  className="p-1 hover:text-slate-200 transition-colors rounded hover:bg-slate-800/40"
                  title="Listen to message"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Message Bubble Card */}
            <div
              className={`rounded-2xl p-4 border text-[13.5px] leading-relaxed backdrop-blur-md ${
                isUser
                  ? 'bg-[#0f172a]/85 border-slate-800/80 text-slate-200'
                  : 'bg-[#11192e]/85 border-slate-800/90 text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.25)]'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Tool Execution Visualization */}
              {msg.toolCall && (
                <div className="mt-3 pt-3 border-t border-slate-800/70 flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center gap-2 text-indigo-400 font-semibold">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Tool invoked: {msg.toolCall.name}</span>
                    <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] bg-indigo-950/80 border border-indigo-700/60 text-indigo-300">
                      {msg.toolCall.status}
                    </span>
                  </div>
                  {msg.toolCall.result && (
                    <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 font-mono text-[11px] text-emerald-300">
                      {msg.toolCall.result}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Live Interim Speech Text (Streaming while speaking) */}
      {liveInterimText && (
        <div className="flex flex-col gap-1.5 animate-pulse">
          <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-full bg-blue-500/50 text-white flex items-center justify-center text-xs">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-300">Speaking now...</span>
          </div>
          <div className="rounded-2xl p-4 bg-slate-900/60 border border-blue-500/40 text-[13.5px] text-blue-200 italic">
            &ldquo;{liveInterimText}&rdquo;
          </div>
        </div>
      )}

      {/* Thinking / Processing animation */}
      {isThinking && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs text-purple-300 animate-pulse">
          <Sparkles className="w-4 h-4 animate-spin" />
          <span>AI is processing your query with Ollama...</span>
        </div>
      )}
    </div>
  );
};
