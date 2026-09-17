import React from 'react';

interface QuickSettingsCardProps {
  aiModel: string;
  onChangeAiModel: (model: string) => void;
  whisperModel: string;
  onChangeWhisperModel: (model: string) => void;
  ttsVoice: string;
  onChangeTtsVoice: (voice: string) => void;
  language: string;
  onChangeLanguage: (lang: string) => void;
  onViewAll: () => void;
}

export const QuickSettingsCard: React.FC<QuickSettingsCardProps> = ({
  aiModel,
  onChangeAiModel,
  whisperModel,
  onChangeWhisperModel,
  ttsVoice,
  onChangeTtsVoice,
  language,
  onChangeLanguage,
  onViewAll,
}) => {
  return (
    <div
      id="quick-settings-card"
      className="rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 p-4 backdrop-blur-xl shadow-lg flex flex-col gap-3.5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white tracking-tight">Quick Settings</h3>
        <button
          onClick={onViewAll}
          id="quick-settings-view-all-btn"
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium cursor-pointer"
        >
          View All
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {/* AI Model */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-400 font-medium">AI Model</label>
          <select
            id="quick-ai-model-select"
            value={aiModel}
            onChange={(e) => onChangeAiModel(e.target.value)}
            className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="llama3.2">llama3.2</option>
            <option value="mistral:7b">mistral:7b</option>
            <option value="deepseek-r1:8b">deepseek-r1:8b</option>
            <option value="phi4:14b">phi4:14b</option>
            <option value="qwen2.5:7b">qwen2.5:7b</option>
          </select>
        </div>

        {/* Whisper Model */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-400 font-medium">Whisper Model</label>
          <select
            id="quick-whisper-model-select"
            value={whisperModel}
            onChange={(e) => onChangeWhisperModel(e.target.value)}
            className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="small">small (recommended)</option>
            <option value="tiny">tiny (fastest)</option>
            <option value="base">base</option>
            <option value="medium">medium (higher accuracy)</option>
            <option value="large-v3">large-v3</option>
          </select>
        </div>

        {/* TTS Voice */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-400 font-medium">TTS Voice</label>
          <select
            id="quick-tts-voice-select"
            value={ttsVoice}
            onChange={(e) => onChangeTtsVoice(e.target.value)}
            className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="en_US-amy">en_US-amy</option>
            <option value="en_US-lessac">en_US-lessac</option>
            <option value="en_GB-alan">en_GB-alan</option>
            <option value="hi_IN-roop">hi_IN-roop (Hindi)</option>
            <option value="gu_IN-shyam">gu_IN-shyam (Gujarati)</option>
          </select>
        </div>

        {/* Language */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-400 font-medium">Language</label>
          <select
            id="quick-language-select"
            value={language}
            onChange={(e) => onChangeLanguage(e.target.value)}
            className="w-full bg-[#080d19] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="Auto (Detect)">Auto (Detect)</option>
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
            <option value="Gujarati">Gujarati</option>
            <option value="Hinglish">Hinglish</option>
          </select>
        </div>
      </div>
    </div>
  );
};
