"use client";

import React, { useState, useMemo } from 'react';
import { Participant } from '@/lib/excel';
import ParticipantTable from './ParticipantTable';
import { Search, Filter, Play, Pause, RotateCcw, Users, CheckCircle, Clock, AlertTriangle, XCircle, X, Mail, Send } from 'lucide-react';

interface DashboardProps {
  initialParticipants: Participant[];
}

const ITEMS_PER_PAGE = 50;

export default function Dashboard({ initialParticipants }: DashboardProps) {
  const [participants] = useState<Participant[]>(initialParticipants);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const [testingParticipant, setTestingParticipant] = useState<Participant | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; data?: { id: string, name: string, expectedFileName: string, mimeType: string, size: number }; error?: string; loading: boolean } | null>(null);

  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; error?: string } | null>(null);

  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [smtpError, setSmtpError] = useState('');

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

  // Calculate statistics
  const stats = useMemo(() => {
    let sent = 0;
    let pending = 0;
    let failed = 0;
    let invalidEmail = 0;

    participants.forEach(p => {
      if (p.status === 'SENT') sent++;
      else if (p.status === 'PENDING') pending++;
      else if (p.status === 'FAILED') failed++;
      
      if (!p.isValidEmail && p.memberEmail) invalidEmail++;
    });

    return { total: participants.length, sent, pending, failed, invalidEmail };
  }, [participants]);

  // Filter participants
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

  // Pagination
  const totalPages = Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE);
  const paginatedParticipants = filteredParticipants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );


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
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md font-medium transition-colors"
            >
              {smtpStatus === 'testing' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700"></div>
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Test SMTP Connection
            </button>
            <button disabled className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-md font-medium cursor-not-allowed hidden">
              <Pause className="w-4 h-4" /> Pause
            </button>
            <button disabled className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-md font-medium cursor-not-allowed hidden">
              <RotateCcw className="w-4 h-4" /> Resume
            </button>
            <button disabled className="flex items-center gap-2 px-4 py-2 bg-blue-600 opacity-50 text-white rounded-md font-medium cursor-not-allowed shadow-sm">
              <Play className="w-4 h-4" /> Start Sending
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard title="Total Participants" value={stats.total} icon={<Users className="text-blue-500" />} />
          <StatCard title="Sent" value={stats.sent} icon={<CheckCircle className="text-green-500" />} />
          <StatCard title="Pending" value={stats.pending} icon={<Clock className="text-yellow-500" />} />
          <StatCard title="Failed" value={stats.failed} icon={<XCircle className="text-red-500" />} />
          <StatCard title="Invalid Email" value={stats.invalidEmail} icon={<AlertTriangle className="text-orange-500" />} />
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
              </select>
            </div>
          </div>

          <ParticipantTable participants={paginatedParticipants} onTestCertificate={handleTestCertificate} />

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

      {/* Modal */}
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

function StatCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow cursor-default">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
      <div className="p-3 bg-gray-50 rounded-full">
        {icon}
      </div>
    </div>
  );
}
