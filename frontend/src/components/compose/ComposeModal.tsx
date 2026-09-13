import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  UploadCloud,
  Clock,
  Send,
  Calendar,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  Code,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { ScheduleFormInput } from '../../types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ScheduleFormInput) => Promise<void>;
  loading: boolean;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultSender = user?.email || 'oliver.brown@domain.io';
  const [senderEmail, setSenderEmail] = useState(defaultSender);
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>(['alex.smith@example.com']);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  // Scheduling options popover state
  const [isScheduleMenuOpen, setIsScheduleMenuOpen] = useState(false);
  const [selectedSchedulePreset, setSelectedSchedulePreset] = useState<'now' | 'tomorrow_8am' | 'tomorrow_10am' | 'tomorrow_1pm' | 'custom'>('now');
  const [customDateTime, setCustomDateTime] = useState('');

  if (!isOpen) return null;

  // Add single email chip
  const addRecipient = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmed) && !recipients.includes(trimmed)) {
      setRecipients([...recipients, trimmed]);
      setRecipientInput('');
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    setRecipients(recipients.filter((_, idx) => idx !== indexToRemove));
  };

  // CSV / TXT Upload Parser (Client-Side)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      // Extract all email patterns across lines/commas/quotes
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = content.match(emailRegex) || [];

      const normalized = Array.from(
        new Set([...recipients, ...matches.map((m) => m.toLowerCase().trim())])
      );

      setRecipients(normalized);
    };

    reader.readAsText(file);
    // Reset file input so user can re-upload if needed
    e.target.value = '';
  };

  const getComputedStartTime = (): Date => {
    const now = new Date();
    if (selectedSchedulePreset === 'now') {
      // Send immediately (within 2 seconds)
      return new Date(now.getTime() + 2000);
    }
    if (selectedSchedulePreset === 'tomorrow_8am') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(8, 0, 0, 0);
      return d;
    }
    if (selectedSchedulePreset === 'tomorrow_10am') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      return d;
    }
    if (selectedSchedulePreset === 'tomorrow_1pm') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(13, 0, 0, 0);
      return d;
    }
    if (selectedSchedulePreset === 'custom' && customDateTime) {
      return new Date(customDateTime);
    }
    return new Date(now.getTime() + 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If user left an email in the text field, add it first
    if (recipientInput) {
      addRecipient(recipientInput);
    }

    if (recipients.length === 0) {
      alert('Please add at least one recipient email.');
      return;
    }

    if (!subject.trim()) {
      alert('Please enter an email subject.');
      return;
    }

    if (!body.trim()) {
      alert('Please enter an email body.');
      return;
    }

    const scheduledTime = getComputedStartTime();

    await onSubmit({
      senderEmail,
      recipients,
      subject,
      body,
      startTime: scheduledTime,
      delayBetweenEmails,
      hourlyLimit,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scale-in my-8 max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-800 text-base">Compose New Email</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto p-6 space-y-4">
          {/* From Line */}
          <div className="flex items-center gap-4 text-sm border-b border-slate-100 pb-3">
            <span className="text-slate-400 w-16 font-medium">From:</span>
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              className="flex-1 font-medium text-slate-800 focus:outline-none focus:ring-0 bg-transparent"
              placeholder="sender@domain.com"
              required
            />
          </div>

          {/* To Line with Chips & CSV Upload */}
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 w-16 text-sm font-medium">To:</span>
              <div className="flex items-center gap-2">
                {recipients.length > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    {recipients.length} recipient{recipients.length > 1 ? 's' : ''} detected
                  </span>
                )}
                {/* Upload CSV/Text File Button matching Figma */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload CSV</span>
                </button>
              </div>
            </div>

            {/* Recipient Chips Container */}
            <div className="flex flex-wrap items-center gap-1.5 min-h-[36px] p-1.5 rounded-xl bg-slate-50/60 border border-slate-200/80">
              {recipients.map((recipient, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white text-emerald-800 border border-emerald-300 shadow-2xs"
                >
                  <span>{recipient}</span>
                  <button
                    type="button"
                    onClick={() => removeRecipient(idx)}
                    className="hover:text-emerald-950 text-emerald-500 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addRecipient(recipientInput);
                  }
                }}
                onBlur={() => {
                  if (recipientInput) addRecipient(recipientInput);
                }}
                placeholder={recipients.length === 0 ? 'Type email address and press Enter...' : 'Add more...'}
                className="flex-1 min-w-[140px] text-xs bg-transparent focus:outline-none text-slate-700 py-1 px-1.5"
              />
            </div>
          </div>

          {/* Subject Line */}
          <div className="flex items-center gap-4 text-sm border-b border-slate-100 pb-3">
            <span className="text-slate-400 w-16 font-medium">Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 font-semibold text-slate-900 focus:outline-none focus:ring-0 bg-transparent"
              placeholder="e.g. Quick follow-up regarding our conversation"
              required
            />
          </div>

          {/* Throttling & Pacing Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Delay between 2 emails (seconds)
              </label>
              <input
                type="number"
                min="0"
                max="3600"
                value={delayBetweenEmails}
                onChange={(e) => setDelayBetweenEmails(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Mimics SMTP provider throttling (per-sender delay)
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Hourly Limit (max emails/hr)
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Redis Lua rate-limited; overflows reschedule to next hour
              </span>
            </div>
          </div>

          {/* Rich Editor Toolbar matching Figma mockup */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col flex-1">
            <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 text-slate-600">
              <button
                type="button"
                onClick={() => setBody(body + ' **bold** ')}
                className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setBody(body + ' *italic* ')}
                className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setBody(body + ' <u>underlined</u> ')}
                className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                title="Underline"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-slate-300 mx-1" />
              <button
                type="button"
                onClick={() => setBody(body + '\n- Item ')}
                className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                title="Bullet List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setBody(body + '\n1. Item ')}
                className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                title="Numbered List"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setBody(body + ' `code` ')}
                className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                title="Code"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Email Body Text Area */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email content here (supports Markdown & HTML)..."
              rows={8}
              className="w-full p-4 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none flex-1 font-sans"
              required
            />
          </div>

          {/* Modal Footer Controls matching Figma */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
            {/* Scheduling Popover Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsScheduleMenuOpen(!isScheduleMenuOpen)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>
                  {selectedSchedulePreset === 'now' && 'Send Immediately'}
                  {selectedSchedulePreset === 'tomorrow_8am' && 'Tomorrow 8:00 AM'}
                  {selectedSchedulePreset === 'tomorrow_10am' && 'Tomorrow 10:00 AM'}
                  {selectedSchedulePreset === 'tomorrow_1pm' && 'Tomorrow 1:00 PM'}
                  {selectedSchedulePreset === 'custom' && (customDateTime ? new Date(customDateTime).toLocaleDateString() : 'Custom Date')}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isScheduleMenuOpen && (
                <div className="absolute left-0 bottom-full mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 text-xs flex flex-col gap-1">
                  <div className="font-semibold text-slate-400 uppercase text-[10px] px-2 py-1">
                    Send Later Presets
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSchedulePreset('now');
                      setIsScheduleMenuOpen(false);
                    }}
                    className={`text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                      selectedSchedulePreset === 'now' ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Send Immediately (5s delay)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSchedulePreset('tomorrow_8am');
                      setIsScheduleMenuOpen(false);
                    }}
                    className={`text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                      selectedSchedulePreset === 'tomorrow_8am' ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Tomorrow 8:00 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSchedulePreset('tomorrow_10am');
                      setIsScheduleMenuOpen(false);
                    }}
                    className={`text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                      selectedSchedulePreset === 'tomorrow_10am' ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Tomorrow 10:00 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSchedulePreset('tomorrow_1pm');
                      setIsScheduleMenuOpen(false);
                    }}
                    className={`text-left px-3 py-2 rounded-lg font-medium transition-colors ${
                      selectedSchedulePreset === 'tomorrow_1pm' ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    Tomorrow 1:00 PM
                  </button>

                  <div className="pt-2 border-t border-slate-100 mt-1">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 px-1">
                      Pick Custom Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => {
                        setCustomDateTime(e.target.value);
                        setSelectedSchedulePreset('custom');
                      }}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-xs hover:bg-slate-50 transition-colors"
              >
                Close
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Scheduling...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Schedule</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
