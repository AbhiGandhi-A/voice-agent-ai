import React, { useState } from 'react';
import { Send, Volume2 } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  onVoiceClick?: () => void;
  disabled?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onVoiceClick,
  disabled = false,
}) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-4">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center gap-2 p-1.5 rounded-2xl bg-[#0c1222]/90 border border-slate-800/90 shadow-[0_4px_24px_rgba(0,0,0,0.3)] backdrop-blur-xl focus-within:border-indigo-500/80 transition-all"
      >
        {/* Left Waveform / Mic Quick Toggle */}
        <button
          type="button"
          id="message-voice-addon-btn"
          onClick={onVoiceClick}
          title="Voice input mode"
          className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800/80 flex items-center justify-center text-indigo-400 hover:text-indigo-300 transition-colors shrink-0"
        >
          <Volume2 className="w-5 h-5" />
        </button>

        {/* Text Input */}
        <input
          id="conversation-message-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message (optional)..."
          disabled={disabled}
          className="flex-1 bg-transparent px-3 py-2 text-slate-200 placeholder-slate-500 text-sm focus:outline-none"
        />

        {/* Send Button */}
        <button
          type="submit"
          id="message-send-btn"
          disabled={!text.trim() || disabled}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all shrink-0 cursor-pointer ${
            text.trim() && !disabled
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_0_14px_rgba(79,70,229,0.5)] hover:from-blue-500 hover:to-indigo-500'
              : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </form>

      {/* Helper Tip */}
      <span className="text-[11.5px] text-slate-400 text-center px-2">
        Tip: You can also just speak — I&apos;ll automatically detect when you stop.
      </span>
    </div>
  );
};
