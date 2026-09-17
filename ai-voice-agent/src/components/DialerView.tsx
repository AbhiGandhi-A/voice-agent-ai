import React, { useState } from 'react';
import { Phone, Delete, PhoneCall, Volume2, ShieldCheck, Asterisk } from 'lucide-react';
import { Call } from '../types';

interface DialerViewProps {
  onStartCall: (phoneNumber: string) => void;
  recentCalls: Call[];
}

export const DialerView: React.FC<DialerViewProps> = ({ onStartCall, recentCalls }) => {
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleDigit = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = () => {
    if (phoneNumber.trim()) {
      onStartCall(phoneNumber);
    }
  };

  const keypad = [
    { num: '1', letters: '' },
    { num: '2', letters: 'ABC' },
    { num: '3', letters: 'DEF' },
    { num: '4', letters: 'GHI' },
    { num: '5', letters: 'JKL' },
    { num: '6', letters: 'MNO' },
    { num: '7', letters: 'PQRS' },
    { num: '8', letters: 'TUV' },
    { num: '9', letters: 'WXYZ' },
    { num: '*', letters: '' },
    { num: '0', letters: '+' },
    { num: '#', letters: '' },
  ];

  return (
    <div className="flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full">
      <div className="w-full max-w-md rounded-3xl bg-[#0c1222]/90 border border-slate-800/90 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl flex flex-col items-center gap-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] mb-2">
            <PhoneCall className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">AI Phone Dialer</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Asterisk SIP Trunk &bull; Instant AI Voice Dispatch
          </p>
        </div>

        {/* Phone Number Display Box */}
        <div className="w-full flex items-center justify-between px-4 py-3 bg-[#080d19] rounded-2xl border border-slate-800">
          <input
            id="dialer-phone-input"
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+91..."
            className="w-full bg-transparent text-center font-mono text-xl sm:text-2xl font-bold text-white focus:outline-none tracking-wider"
          />
          {phoneNumber.length > 0 && (
            <button
              onClick={handleBackspace}
              className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
              title="Backspace"
            >
              <Delete className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[300px]">
          {keypad.map((k) => (
            <button
              key={k.num}
              onClick={() => handleDigit(k.num)}
              className="h-16 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 flex flex-col items-center justify-center text-white transition-all active:scale-95 cursor-pointer shadow-sm group"
            >
              <span className="text-xl font-bold tracking-tight text-slate-200 group-hover:text-white">
                {k.num}
              </span>
              {k.letters && (
                <span className="text-[9px] font-semibold text-slate-500 tracking-widest group-hover:text-slate-400">
                  {k.letters}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Large Green Call Button */}
        <div className="w-full flex items-center justify-center mt-2">
          <button
            id="dialer-call-btn"
            onClick={handleCall}
            disabled={!phoneNumber.trim()}
            className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Phone className="w-8 h-8 fill-white" />
          </button>
        </div>

        {/* Status notice */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Telephony Bridge Ready (Asterisk 20.6 LTS)</span>
        </div>
      </div>
    </div>
  );
};
