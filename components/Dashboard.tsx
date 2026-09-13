"use client";

import React, { useState, useMemo, useRef, useCallback } from 'react';
import ParticipantTable from './ParticipantTable';
import {
  Search, Filter, Play, Pause, RotateCcw, Users, CheckCircle,
  Clock, AlertTriangle, XCircle, X, Mail, Send, FileX, Zap
} from 'lucide-react';
import type { ParticipantStatus } from '@/lib/status';

interface Participant {
  teamName: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  status: ParticipantStatus;
}

interface DashboardProps {
  initialParticipants: Participant[];
  initialDailyCount: number;
  dailyLimit: number;
}

type SendingState = 'idle' | 'sending' | 'paused' | 'completed' | 'daily_limit_reached' | 'error';

interface CurrentParticipant {
  name: string;
  email: string;
  action: string;
}

const ITEMS_PER_PAGE = 50;

export default function Dashboard({ initialParticipants, initialDailyCount, dailyLimit }: DashboardProps) {
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Sending state
  const [sendingState, setSendingState] = useState<SendingState>('idle');
  const [currentParticipant, setCurrentParticipant] = useState<CurrentParticipant | null>(null);
  const [dailySent, setDailySent] = useState(initialDailyCount);
  const [systemError, setSystemError] = useState('');

  // Pause flag — use ref so the running loop sees the latest value
  const pauseRequestedRef = useRef(false);

  // Test certificate modal state (kept from Phase 3)
  const [testingParticipant, setTestingParticipant] = useState<Participant | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; data?: { id: string; name: string; expectedFileName: string; mimeType: string; size: number }; error?: string; loading: boolean } | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; error?: string } | null>(null);

  // SMTP state
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [smtpError, setSmtpError] = useState('');

  // --- Handlers from Phase 3 (test certificate + SMTP verify) ---

  const handleTestCertificate = async (participant: Participant) => {
    setTestingParticipant(participant);
    setTestResult({ success: false, loading: true });
    setEmailResult(null);
    setTestEmailAddress('');

    try {
      const res = await fetch('/api/certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: participant.memberEmail })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setTestResult({ success: true, loading: false, data: data.metadata });
      } else {
        setTestResult({ success: false, loading: false, error: data.error || 'Unknown error' });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      setTestResult({ success: false, loading: false, error: errorMessage });
    }
  };

  const handleVerifySMTP = async () => {
    setSmtpStatus('testing');
    try {
      const res = await fetch('/api/email/verify-smtp');
      const data = await res.json();
      if (res.ok && data.success) {
        setSmtpStatus('success');
        setSmtpError('');
      } else {
        setSmtpStatus('error');
        setSmtpError(data.error || 'Unknown error');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      setSmtpStatus('error');
      setSmtpError(errorMessage);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testingParticipant || !testEmailAddress) return;

    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testingParticipant.memberEmail,
          testRecipientEmail: testEmailAddress
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setEmailResult({ success: true });
      } else {
        setEmailResult({ success: false, error: data.error || 'Unknown error' });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      setEmailResult({ success: false, error: errorMessage });
    } finally {
      setEmailSending(false);
    }
  };

  // --- Batch sending loop ---

  const sendLoop = useCallback(async () => {
    setSendingState('sending');
    setSystemError('');
    pauseRequestedRef.current = false;

    while (true) {
      // Check if pause requested
      if (pauseRequestedRef.current) {
        setSendingState('paused');
        setCurrentParticipant(null);
        return;
      }

      setCurrentParticipant({ name: '', email: '', action: 'Processing next batch...' });

      try {
        const res = await fetch('/api/send', { method: 'POST' });

        if (!res.ok) {
          const data = await res.json();
          setSystemError(data.error || 'Server error');
          setSendingState('error');
          setCurrentParticipant(null);
          return;
        }

        const data = await res.json();
        const results: { email: string; name: string; team: string; status: ParticipantStatus; action: string }[] =
          Array.isArray(data.processed) ? data.processed : (data.processed ? [data.processed] : []);

        // Update participant statuses from batch results
        if (data.stats && results.length > 0) {
          setParticipants(prev => {
            const updated = [...prev];
            for (const result of results) {
              const idx = updated.findIndex(p =>
                p.memberEmail === result.email &&
                p.memberName === result.name &&
                p.teamName === result.team
              );
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], status: result.status };
              }
            }
            return updated;
          });
        }

        if (data.dailyCount) {
          setDailySent(data.dailyCount.sent);
        }

        if (results.length > 0) {
          const last = results[results.length - 1];
          const sentCount = results.filter(r => r.status === 'SENT').length;
          setCurrentParticipant({
            name: results.length > 1 ? `Batch: ${results.length} processed (${sentCount} sent)` : last.name,
            email: results.length > 1 ? '' : last.email,
            action: last.action,
          });
        }

        // Check stop conditions
        if (data.stopped) {
          if (data.stopReason === 'DAILY_LIMIT_REACHED') {
            setSendingState('daily_limit_reached');
          } else {
            setSendingState('completed');
          }
          setCurrentParticipant(null);
          return;
        }

        // Small delay between batches for UI readability
        await new Promise(r => setTimeout(r, 300));

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Network error';
        setSystemError(errorMessage);
        setSendingState('error');
        setCurrentParticipant(null);
        return;
      }
    }
  }, []);

  const handleStart = () => {
    if (sendingState === 'sending') return;
    sendLoop();
  };

  const handlePause = () => {
    pauseRequestedRef.current = true;
  };

  const handleResume = () => {
    if (sendingState !== 'paused' && sendingState !== 'error') return;
    sendLoop();
  };

  // --- Statistics ---

  const stats = useMemo(() => {
    let sent = 0, pending = 0, failed = 0, invalidEmail = 0, certificateNotFound = 0;

    participants.forEach(p => {
      switch (p.status) {
        case 'SENT': sent++; break;
        case 'FAILED': failed++; break;
        case 'INVALID_EMAIL': invalidEmail++; break;
        case 'CERTIFICATE_NOT_FOUND': certificateNotFound++; break;
        default: pending++; break;
      }
    });

    return { total: participants.length, sent, pending, failed, invalidEmail, certificateNotFound };
  }, [participants]);

  // --- Filtering + Pagination ---

  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        p.memberName.toLowerCase().includes(searchLower) ||
        p.memberEmail.toLowerCase().includes(searchLower) ||
        p.teamName.toLowerCase().includes(searchLower);

      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [participants, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE);
  const paginatedParticipants = filteredParticipants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // --- Derived state ---
  const isSending = sendingState === 'sending';
  const isPaused = sendingState === 'paused';
  const isIdle = sendingState === 'idle';
  const canStart = isIdle || sendingState === 'error';
  const canPause = isSending;
  const canResume = isPaused || sendingState === 'error';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-blue-600">NexHack</span> Certificate Sender
            </h1>
            <p className="text-sm text-gray-500 mt-1">Manage and send certificates to online round participants.</p>
          </div>
          <div className="flex gap-3 items-center">
            {smtpStatus === 'success' && <span className="text-sm text-green-600 font-medium">SMTP Connected ✓</span>}
            {smtpStatus === 'error' && <span className="text-sm text-red-600 font-medium" title={smtpError}>SMTP Error</span>}
            <button
              onClick={handleVerifySMTP}
              disabled={isSending}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {smtpStatus === 'testing' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Test SMTP
            </button>

            {canPause && (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 rounded-md font-medium transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}

            {canResume && (
              <button
                onClick={handleResume}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 hover:bg-green-200 rounded-md font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Resume
              </button>
            )}

            {canStart && (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Play className="w-4 h-4" />
                Start Sending
              </button>
            )}

            {isSending && (
              <span className="flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 rounded-md font-medium animate-pulse">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Sending...
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Status Banner */}
        {sendingState === 'completed' && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">All participants processed.</p>
              <p className="text-sm mt-1">
                Sent: {stats.sent} · Failed: {stats.failed} · Invalid Email: {stats.invalidEmail} · Cert Not Found: {stats.certificateNotFound}
              </p>
            </div>
          </div>
        )}

        {sendingState === 'daily_limit_reached' && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">Daily limit reached ({dailySent} / {dailyLimit})</p>
              <p className="text-sm mt-1">Sending has stopped. Resume manually on the next day.</p>
            </div>
          </div>
        )}

        {sendingState === 'paused' && (
          <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
            <Pause className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">Sending paused</p>
              <p className="text-sm mt-1">Click Resume to continue from the next unsent participant.</p>
            </div>
          </div>
        )}

        {sendingState === 'error' && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <XCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">System error</p>
              <p className="text-sm mt-1">{systemError}</p>
              <p className="text-sm mt-1">Click Resume to retry.</p>
            </div>
          </div>
        )}

        {/* Current Participant */}
        {currentParticipant && isSending && (
          <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Zap className="w-5 h-5 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-blue-900 truncate">
                  {currentParticipant.name || 'Processing...'}
                </p>
                {currentParticipant.email && (
                  <span className="text-sm text-blue-600">{currentParticipant.email}</span>
                )}
              </div>
              <p className="text-sm text-blue-700 mt-0.5">{currentParticipant.action}</p>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard title="Total" value={stats.total} icon={<Users className="text-blue-500" />} />
          <StatCard title="Sent" value={stats.sent} icon={<CheckCircle className="text-green-500" />} />
          <StatCard title="Pending" value={stats.pending} icon={<Clock className="text-yellow-500" />} />
          <StatCard title="Failed" value={stats.failed} icon={<XCircle className="text-red-500" />} />
          <StatCard title="Invalid Email" value={stats.invalidEmail} icon={<AlertTriangle className="text-orange-500" />} />
          <StatCard title="Cert Not Found" value={stats.certificateNotFound} icon={<FileX className="text-purple-500" />} />
          <StatCard
            title="Today's Emails"
            value={dailySent}
            subtitle={`/ ${dailyLimit}`}
            icon={<Send className="text-indigo-500" />}
          />
        </div>

        {/* Filters and Table */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, email, or team..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg bg-white appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
                <option value="INVALID_EMAIL">Invalid Email</option>
                <option value="CERTIFICATE_NOT_FOUND">Cert Not Found</option>
              </select>
            </div>
          </div>

          <ParticipantTable
            participants={paginatedParticipants}
            currentEmail={currentParticipant?.email}
            onTestCertificate={handleTestCertificate}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <p className="text-sm text-gray-600">
                Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredParticipants.length)}</span> of <span className="font-medium">{filteredParticipants.length}</span> results
              </p>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      </main>

      {/* Test Certificate Modal (from Phase 3) */}
      {testingParticipant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Test Certificate</h3>
              <button onClick={() => setTestingParticipant(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-500">Participant</p>
                <p className="font-medium">{testingParticipant.memberName} ({testingParticipant.teamName})</p>
              </div>

              {testResult?.loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : testResult?.success && testResult.data ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600 font-medium bg-green-50 p-3 rounded-lg">
                    <CheckCircle className="w-5 h-5" />
                    Certificate Found
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                    <p><span className="text-gray-500">File Name:</span> {testResult.data.name}</p>
                    <p><span className="text-gray-500">Expected Name:</span> {testResult.data.expectedFileName}</p>
                    <p><span className="text-gray-500">File Type:</span> {testResult.data.mimeType}</p>
                    <p><span className="text-gray-500">File Size:</span> {(testResult.data.size / 1024).toFixed(2)} KB</p>
                  </div>

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Send Test Email</h4>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="recipient@example.com"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                      <button
                        onClick={handleSendTestEmail}
                        disabled={emailSending || !testEmailAddress || !/^\S+@\S+\.\S+$/.test(testEmailAddress)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        {emailSending ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Send
                      </button>
                    </div>

                    {emailResult && (
                      <div className={`mt-3 p-3 rounded-md text-sm ${emailResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        {emailResult.success ? (
                          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Test email sent successfully!</div>
                        ) : (
                          <div className="flex items-start gap-2"><XCircle className="w-4 h-4 mt-0.5 shrink-0" /> <div>Failed to send test email: {emailResult.error}</div></div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 text-red-600 font-medium bg-red-50 p-3 rounded-lg">
                    <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p>Certificate Not Found or Error</p>
                      <p className="text-sm font-normal mt-1">{testResult?.error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }: { title: string; value: number; subtitle?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow cursor-default">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">
          {value}
          {subtitle && <span className="text-sm font-medium text-gray-400 ml-0.5">{subtitle}</span>}
        </p>
      </div>
      <div className="p-2.5 bg-gray-50 rounded-full">
        {icon}
      </div>
    </div>
  );
}
