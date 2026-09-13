import React from 'react';
import { ScheduledEmail } from '../../types';
import { Send, ExternalLink, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface SentTableProps {
  emails: ScheduledEmail[];
  loading: boolean;
  onSelectEmail: (email: ScheduledEmail) => void;
  onOpenCompose: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({
  emails,
  loading,
  onSelectEmail,
  onOpenCompose,
}) => {
  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'MMM d, yyyy • h:mm a');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-slate-100/80 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
          <Send className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 mb-1">No sent emails yet</h3>
        <p className="text-sm text-slate-500 max-w-sm mb-6">
          When scheduled emails are dispatched through Ethereal SMTP, their delivery status and inbox preview links appear here.
        </p>
        <button
          onClick={onOpenCompose}
          className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
        >
          Compose New Email
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/70">
            <th className="py-3.5 px-6">Recipient</th>
            <th className="py-3.5 px-6">Subject</th>
            <th className="py-3.5 px-6">Sent Time</th>
            <th className="py-3.5 px-6">Status</th>
            <th className="py-3.5 px-6 text-right">Ethereal Inbox</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {emails.map((email) => (
            <tr
              key={email.id}
              onClick={() => onSelectEmail(email)}
              className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
            >
              <td className="py-4 px-6 font-medium text-slate-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {email.recipientEmail.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate max-w-[180px]">{email.recipientEmail}</span>
                </div>
              </td>
              <td className="py-4 px-6 max-w-xs">
                <div className="font-semibold text-slate-800 truncate">{email.subject}</div>
                <div className="text-xs text-slate-400 truncate mt-0.5">
                  {email.body.replace(/<[^>]*>?/gm, '')}
                </div>
              </td>
              <td className="py-4 px-6 text-slate-500 text-xs">
                {formatTimestamp(email.sentAt || email.createdAt)}
              </td>
              <td className="py-4 px-6">
                {email.status === 'SENT' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Sent
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/50">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                    Failed
                  </span>
                )}
              </td>
              <td className="py-4 px-6 text-right">
                {email.etherealPreviewUrl ? (
                  <a
                    href={email.etherealPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200/60"
                  >
                    <span>View Inbox</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
