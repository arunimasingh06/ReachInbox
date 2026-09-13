import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Clock, Send, Plus, Activity, ExternalLink, Hash, CheckCircle2 } from 'lucide-react';
import { SlackStatus } from '../../types';

interface SidebarProps {
  activeTab: 'scheduled' | 'sent';
  onSelectTab: (tab: 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  scheduledCount: number;
  sentCount: number;
  slackStatus: SlackStatus | null;
  onConnectSlack: () => void;
  onDisconnectSlack: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenCompose,
  scheduledCount,
  sentCount,
  slackStatus,
  onConnectSlack,
  onDisconnectSlack,
}) => {
  const { user } = useAuth();

  const userDisplayName = user?.name || user?.email?.split('@')[0] || 'Oliver Brown';
  const userHandle = user?.email || 'oliver.brown@reachinbox.ai';
  const avatarUrl = user?.avatar;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen flex flex-col justify-between flex-shrink-0 select-none">
      {/* Top Section */}
      <div className="p-5 flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-600/20 tracking-tighter">
            ONE
          </div>
          <div>
            <span className="font-bold text-slate-900 tracking-tight text-lg">ReachInbox</span>
            <span className="block text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
              Scheduler
            </span>
          </div>
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userDisplayName}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/20"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm ring-2 ring-emerald-500/20">
              {userDisplayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="overflow-hidden">
            <div className="text-sm font-semibold text-slate-800 truncate">{userDisplayName}</div>
            <div className="text-xs text-slate-400 truncate">{userHandle}</div>
          </div>
        </div>

        {/* Primary Compose Button */}
        <button
          onClick={onOpenCompose}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Compose</span>
        </button>

        {/* Navigation Tabs */}
        <nav className="flex flex-col gap-1.5">
          <button
            onClick={() => onSelectTab('scheduled')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'scheduled'
                ? 'bg-emerald-50 text-emerald-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className={`w-4 h-4 ${activeTab === 'scheduled' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Scheduled</span>
            </div>
            {scheduledCount > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  activeTab === 'scheduled' ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {scheduledCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSelectTab('sent')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'sent'
                ? 'bg-emerald-50 text-emerald-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <Send className={`w-4 h-4 ${activeTab === 'sent' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Sent</span>
            </div>
            {sentCount > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  activeTab === 'sent' ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {sentCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Bottom Integrations Section */}
      <div className="p-4 border-t border-slate-100 flex flex-col gap-3">
        {/* Slack Connection Status Widget */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Hash className="w-3.5 h-3.5 text-purple-600" />
              <span>Slack Alerts</span>
            </div>
            {slackStatus?.connected && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>

          {slackStatus?.connected ? (
            <div>
              <p className="text-slate-500 text-[11px] mb-2 truncate">
                Connected to <span className="font-medium text-slate-700">#{slackStatus.details?.channel || 'general'}</span>
              </p>
              <button
                onClick={onDisconnectSlack}
                className="w-full py-1 px-2 text-[11px] text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors font-medium"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              <p className="text-slate-400 text-[11px] mb-2">
                Get notified instantly when hourly sending caps are reached.
              </p>
              <button
                onClick={onConnectSlack}
                className="w-full py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <span>Connect Slack</span>
              </button>
            </div>
          )}
        </div>

        {/* Live BullMQ Queue Link */}
        <a
          href="http://localhost:5001/admin/queues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span>BullMQ Dashboard</span>
          </div>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>
      </div>
    </aside>
  );
};
