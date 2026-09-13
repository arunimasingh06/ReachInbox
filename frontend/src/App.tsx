import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { ScheduledTable } from './components/emails/ScheduledTable';
import { SentTable } from './components/emails/SentTable';
import { ComposeModal } from './components/compose/ComposeModal';
import { EmailDetailDrawer } from './components/emails/EmailDetailDrawer';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import {
  getScheduledEmailsApi,
  getSentEmailsApi,
  searchEmailsApi,
  scheduleEmailsApi,
  cancelEmailApi,
  getSlackStatusApi,
  getSlackOAuthUrlApi,
  disconnectSlackApi,
} from './services/api';
import { ScheduledEmail, ScheduleFormInput, SlackStatus } from './types';

export const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  // Navigation & View States
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);

  // Email Data States
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [sentEmails, setSentEmails] = useState<ScheduledEmail[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [sentTotal, setSentTotal] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  // Elasticsearch Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ScheduledEmail[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Slack Integration State
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);

  // Toast Notifications State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Check URL query parameters for Slack OAuth callback response
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('slack') === 'connected') {
      addToast('Slack connected successfully! Hourly rate limit alerts enabled.', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlParams.get('slack_error')) {
      addToast(`Slack connection failed: ${urlParams.get('slack_error')}`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch emails and Slack status
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const [schedRes, sentRes, slackRes] = await Promise.all([
        getScheduledEmailsApi(1, 50),
        getSentEmailsApi(1, 50),
        getSlackStatusApi().catch(() => ({ connected: false })),
      ]);

      setScheduledEmails(schedRes.emails || []);
      setScheduledTotal(schedRes.total || 0);
      setSentEmails(sentRes.emails || []);
      setSentTotal(sentRes.total || 0);
      setSlackStatus(slackRes);
    } catch (err: any) {
      console.error('Error fetching dashboard emails:', err);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      // Periodically poll every 5 seconds to update real-time status transitions
      const interval = setInterval(fetchDashboardData, 5000);
      return () => clearInterval(interval);
    }
  }, [user, fetchDashboardData]);

  // Elasticsearch live search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchEmailsApi(searchQuery);
        setSearchResults(res.emails || []);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Schedule email submission handler
  const handleScheduleSubmit = async (formData: ScheduleFormInput) => {
    setIsSubmittingSchedule(true);
    try {
      const res = await scheduleEmailsApi(formData);
      addToast(`Successfully scheduled ${res.count} email${res.count > 1 ? 's' : ''}!`, 'success');
      setIsComposeOpen(false);
      await fetchDashboardData();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to schedule emails', 'error');
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  // Cancel scheduled email handler
  const handleCancelEmail = async (id: string) => {
    try {
      await cancelEmailApi(id);
      addToast('Scheduled email cancelled', 'info');
      await fetchDashboardData();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to cancel email', 'error');
    }
  };

  // Slack OAuth Handlers
  const handleConnectSlack = async () => {
    try {
      const res = await getSlackOAuthUrlApi();
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to initiate Slack connection', 'error');
    }
  };

  const handleDisconnectSlack = async () => {
    try {
      await disconnectSlackApi();
      setSlackStatus({ connected: false });
      addToast('Slack workspace disconnected', 'info');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to disconnect Slack', 'error');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading ReachInbox...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginScreen onShowToast={addToast} />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  // Determine emails to render based on active tab and search state
  const displayedEmails = searchResults !== null
    ? searchResults.filter((e) =>
        activeTab === 'scheduled'
          ? ['PENDING', 'SCHEDULED', 'PROCESSING'].includes(e.status)
          : ['SENT', 'FAILED'].includes(e.status)
      )
    : activeTab === 'scheduled'
    ? scheduledEmails
    : sentEmails;

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSearchQuery('');
          setSearchResults(null);
        }}
        onOpenCompose={() => setIsComposeOpen(true)}
        scheduledCount={scheduledTotal}
        sentCount={sentTotal}
        slackStatus={slackStatus}
        onConnectSlack={handleConnectSlack}
        onDisconnectSlack={handleDisconnectSlack}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation Bar */}
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearSearch={() => {
            setSearchQuery('');
            setSearchResults(null);
          }}
          isSearching={isSearching}
        />

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto bg-white p-6">
          <div className="max-w-7xl mx-auto">
            {/* View Header */}
            <div className="flex items-center justify-between pb-6 mb-2 border-b border-slate-100">
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {searchResults !== null
                    ? `Search Results for "${searchQuery}" (${displayedEmails.length})`
                    : activeTab === 'scheduled'
                    ? 'Scheduled Emails'
                    : 'Sent Emails'}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {activeTab === 'scheduled'
                    ? 'Emails waiting in the BullMQ queue for delayed execution and rate limits.'
                    : 'Delivered outreach emails with fake SMTP preview links.'}
                </p>
              </div>

              {searchResults !== null && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                  }}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"
                >
                  Clear Search
                </button>
              )}
            </div>

            {/* Email List Tables */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {activeTab === 'scheduled' ? (
                <ScheduledTable
                  emails={displayedEmails}
                  loading={dataLoading && scheduledEmails.length === 0}
                  onCancelEmail={handleCancelEmail}
                  onSelectEmail={setSelectedEmail}
                  onOpenCompose={() => setIsComposeOpen(true)}
                />
              ) : (
                <SentTable
                  emails={displayedEmails}
                  loading={dataLoading && sentEmails.length === 0}
                  onSelectEmail={setSelectedEmail}
                  onOpenCompose={() => setIsComposeOpen(true)}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSubmit={handleScheduleSubmit}
        loading={isSubmittingSchedule}
      />

      {/* Email Detail Slide-out Drawer */}
      <EmailDetailDrawer
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
      />

      {/* Toast Notifications Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
