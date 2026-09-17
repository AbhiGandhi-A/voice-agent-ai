import React, { useState } from 'react';
import { Search, Plus, Phone, Mail, Building, Trash2, Edit2, User, Users } from 'lucide-react';
import { Contact } from '../types';

interface ContactsViewProps {
  contacts: Contact[];
  onAddContact: (contact: Omit<Contact, 'id' | 'callCount' | 'lastCall'>) => void;
  onDeleteContact: (id: string) => void;
  onCallContact: (phone: string) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onAddContact,
  onDeleteContact,
  onCallContact,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      c.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && phone.trim()) {
      onAddContact({ name, phone, email, company, notes });
      setName('');
      setPhone('');
      setEmail('');
      setCompany('');
      setNotes('');
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Customer Directory</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage caller contacts, VIP customer routing, and telephony metadata.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-[0_0_16px_rgba(99,102,241,0.4)] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Contact</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by customer name, phone number, or company..."
          className="w-full pl-10 pr-4 py-2.5 bg-[#0c1222]/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Contacts Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0c1222]/60 border border-slate-800 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No Contacts in Directory</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {searchTerm
              ? 'No contacts match your search query.'
              : 'Add your first customer contact to enable 1-click dialing, caller ID lookup, and conversation tracking.'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Your First Contact</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((contact) => (
            <div
              key={contact.id}
              className="p-5 rounded-2xl bg-[#0c1222]/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-sm text-indigo-300">
                    {contact.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{contact.name}</h3>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {contact.company || 'Private'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onCallContact(contact.phone)}
                  className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-colors"
                  title={`Call ${contact.name}`}
                >
                  <Phone className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5 text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-3 h-3" />
                  <span className="font-mono text-slate-200">{contact.phone}</span>
                </div>
                {contact.email && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Mail className="w-3 h-3" />
                    <span className="text-slate-300 truncate">{contact.email}</span>
                  </div>
                )}
                {contact.notes && (
                  <p className="text-[11px] text-slate-400 mt-1 italic">&ldquo;{contact.notes}&rdquo;</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                <span>{contact.callCount} calls logged</span>
                <button
                  onClick={() => onDeleteContact(contact.id)}
                  className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                  title="Delete Contact"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Contact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0c1222] border border-slate-800 p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Add New Contact</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#080d19] border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Maya Sharma"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-medium">Phone Number</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#080d19] border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="e.g. +91 98765 12345"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-medium">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#080d19] border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. maya@example.com"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-medium">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#080d19] border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Apex Logistics"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400 font-medium">Notes & Language Preference</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#080d19] border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Speaks Hindi / English. VIP buyer."
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
