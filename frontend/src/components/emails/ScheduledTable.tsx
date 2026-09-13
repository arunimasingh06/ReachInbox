import React from 'react';
import { ScheduledEmail } from '../../types';
import { Clock, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';

interface ScheduledTableProps {
  emails: ScheduledEmail[];
  loading: boolean;
  onCancelEmail: (id: string) => void;
  onSelectEmail: (email: ScheduledEmail) => void;
  onOpenCompose: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onCancelEmail,
  onSelectEmail,
  onOpenCompose,
}) => {
  const formatScheduledBadge = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isToday(date)) {
        return `Today at ${format(date, 'h:mm a')}`;
      }
      if (isTomorrow(date)) {
        return `Tomorrow at ${format(date, 'h:mm a')}`;
      }
      return format(date, 'MMM d, yyyy • h:mm a');
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
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
          <Clock className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 mb-1">No scheduled emails</h3>
        <p className="text-sm text-slate-500 max-w-sm mb-6">
          Schedule an email campaign or lead outreach with automatic delay spacing and hourly rate limits.
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
            <th className="py-3.5 px-6">Subject & Content</th>
            <th className="py-3.5 px-6">Scheduled Time</th>
            <th className="py-3.5 px-6">Pacing / Limits</th>
            <th className="py-3.5 px-6">Status</th>
            <th className="py-3.5 px-6 text-right">Action</th>
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
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
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
              <td className="py-4 px-6">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-xs font-medium border border-amber-200/60">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <span>{formatScheduledBadge(email.scheduledTime)}</span>
                </span>
              </td>
              <td className="py-4 px-6 text-xs text-slate-500">
                <div>
                  <span className="font-medium text-slate-700">{email.delayBetweenEmails}s</span> spacing
                </div>
                <div className="text-[11px] text-slate-400">
                  Cap: <span className="font-medium">{email.hourlyLimit}</span>/hr
                </div>
              </td>
              <td className="py-4 px-6">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    email.status === 'PROCESSING'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      email.status === 'PROCESSING' ? 'bg-blue-500 animate-ping' : 'bg-emerald-500'
                    }`}
                  />
                  {email.status}
                </span>
              </td>
              <td className="py-4 px-6 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelEmail(email.id);
                  }}
                  title="Cancel scheduled email"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
