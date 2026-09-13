import React from 'react';
import { ScheduledEmail } from '../../types';
import { X, ArrowLeft, ExternalLink, Calendar, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { format } from 'date-fns';

interface EmailDetailDrawerProps {
  email: ScheduledEmail | null;
  onClose: () => void;
}

export const EmailDetailDrawer: React.FC<EmailDetailDrawerProps> = ({ email, onClose }) => {
  if (!email) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'EEEE, MMMM d, yyyy • h:mm a');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-slide-left">
        {/* Drawer Header */}
        <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="font-bold text-slate-800 text-base truncate max-w-md">
              {email.subject}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Metadata Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  {email.senderEmail.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{email.senderEmail}</div>
                  <div className="text-xs text-slate-500">To: {email.recipientEmail}</div>
                </div>
              </div>
              <div>
                {email.status === 'SENT' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Sent
                  </span>
                ) : email.status === 'FAILED' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    Failed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    Scheduled
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {email.status === 'SENT'
                    ? `Sent: ${formatDate(email.sentAt)}`
                    : `Scheduled for: ${formatDate(email.scheduledTime)}`}
                </span>
              </div>

              {email.etherealPreviewUrl && (
                <a
                  href={email.etherealPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  <span>Open Ethereal Mail</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Email Body matching Figma mockup */}
          <div className="border border-slate-100 rounded-xl p-6 bg-white shadow-xs">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{email.subject}</h3>
            <div
              className="prose prose-sm max-w-none text-slate-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: email.body }}
            />
          </div>

          {/* Job & Pacing Information */}
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/40 text-xs text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700 mb-1">Queue & Scheduling Metadata</div>
            <div>
              Job ID: <span className="font-mono text-slate-800">{email.id}</span>
            </div>
            <div>
              Delay Spacing: <span className="font-medium text-slate-800">{email.delayBetweenEmails}s</span> between sends
            </div>
            <div>
              Sender Hourly Cap: <span className="font-medium text-slate-800">{email.hourlyLimit}</span> emails/hour
            </div>
            {email.error && (
              <div className="text-rose-600 font-medium pt-1">
                Failure Reason: {email.error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
