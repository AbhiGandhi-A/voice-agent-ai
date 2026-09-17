import React, { useState } from 'react';
import {
  PhoneCall,
  PhoneForwarded,
  CheckCircle2,
  XCircle,
  UserCheck,
  Play,
  FileText,
  Phone,
} from 'lucide-react';
import { Call } from '../types';

interface CallsViewProps {
  calls: Call[];
  onOpenLiveCall: (call: Call) => void;
  onOpenDialer: () => void;
}

export const CallsView: React.FC<CallsViewProps> = ({
  calls,
  onOpenLiveCall,
  onOpenDialer,
}) => {
  const [selectedSummaryCall, setSelectedSummaryCall] = useState<Call | null>(null);

  const totalCalls = calls.length;
  const connectedCalls = calls.filter((c) => c.status === 'completed' || c.status === 'connected').length;
  const missedCalls = calls.filter((c) => c.status === 'missed').length;
  const aiHandled = calls.filter((c) => c.aiStatus === 'AI handled').length;
  const humanTakeover = calls.filter((c) => c.aiStatus === 'Human takeover').length;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Top Banner & Quick Dialer Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">AI Call Center Hub</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telephony oversight, Asterisk SIP bridging, and automated customer conversation records.
          </p>
        </div>
        <button
          onClick={onOpenDialer}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-[0_0_16px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
        >
          <Phone className="w-4 h-4" />
          <span>Open Phone Dialer</span>
        </button>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex flex-col gap-1">
          <span className="text-[11px] text-slate-400 font-medium">Total Calls</span>
          <span className="text-2xl font-bold text-white">{totalCalls}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Connected</span>
          </div>
          <span className="text-2xl font-bold text-emerald-400">{connectedCalls}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium">
            <XCircle className="w-3.5 h-3.5" />
            <span>Missed</span>
          </div>
          <span className="text-2xl font-bold text-rose-400">{missedCalls}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-indigo-400 text-[11px] font-medium">
            <PhoneCall className="w-3.5 h-3.5" />
            <span>AI Handled</span>
          </div>
          <span className="text-2xl font-bold text-indigo-400">{aiHandled}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-medium">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Human Takeover</span>
          </div>
          <span className="text-2xl font-bold text-amber-400">{humanTakeover}</span>
        </div>
      </div>

      {/* Calls Table */}
      <div className="rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 overflow-hidden backdrop-blur-xl shadow-lg">
        <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Recent Call Logs</h3>
          <span className="text-xs text-slate-400 font-mono">Asterisk SIP Trunk v20</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">AI Oversight</th>
                <th className="py-3 px-4">Started</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <PhoneCall className="w-6 h-6 text-slate-600" />
                      <span className="text-xs font-semibold text-slate-300">No Calls Logged Yet</span>
                      <span className="text-[11px] text-slate-500">
                        Use the Phone Dialer to place an outbound call or test AI voice handling.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr
                    key={call.id}
                    className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => onOpenLiveCall(call)}
                  >
                    <td className="py-3.5 px-4 font-mono text-slate-200">{call.phoneNumber}</td>
                    <td className="py-3.5 px-4 text-white font-semibold">{call.contactName}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] ${
                          call.status === 'completed'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                            : call.status === 'missed'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                            : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60'
                        }`}
                      >
                        {call.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{call.duration}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[11px] font-medium ${
                          call.aiStatus === 'AI handled'
                            ? 'text-indigo-400'
                            : call.aiStatus === 'Human takeover'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        ● {call.aiStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">{call.startedAt}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onOpenLiveCall(call)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-all text-[11px]"
                        >
                          Transcript
                        </button>
                        {call.summary && (
                          <button
                            onClick={() => setSelectedSummaryCall(call)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="View Summary"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Modal */}
      {selectedSummaryCall && selectedSummaryCall.summary && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#0c1222] border border-slate-800 p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Call Summary & Ollama Insights</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {selectedSummaryCall.phoneNumber} • {selectedSummaryCall.contactName}
                </span>
              </div>
              <button
                onClick={() => setSelectedSummaryCall(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-semibold mb-1 uppercase tracking-wider">
                  Summary
                </span>
                <p className="leading-relaxed">{selectedSummaryCall.summary.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Outcome</span>
                  <div className="text-emerald-400 font-bold mt-0.5">{selectedSummaryCall.summary.outcome}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Customer Intent</span>
                  <div className="text-indigo-300 font-medium mt-0.5">{selectedSummaryCall.summary.customerIntent}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                  AI Automated Actions
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11.5px]">
                  {selectedSummaryCall.summary.aiActions.map((act, i) => (
                    <li key={i}>{act}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={() => setSelectedSummaryCall(null)}
              className="mt-2 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
            >
              Close Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
