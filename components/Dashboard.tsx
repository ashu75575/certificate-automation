"use client";

import React, { useState, useMemo, useRef, useCallback } from 'react';
import ParticipantTable from './ParticipantTable';
import {
  Search, Filter, Play, Pause, RotateCcw, Users, CheckCircle,
  Clock, AlertTriangle, XCircle, Mail, Send, FileX, Zap
} from 'lucide-react';
import type { ParticipantStatus } from '@/lib/status';
import { motion, AnimatePresence } from 'framer-motion';
import GradientWaves from './GradientWaves';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

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

  // Pause flag
  const pauseRequestedRef = useRef(false);

  // Test certificate modal state
  const [testingParticipant, setTestingParticipant] = useState<Participant | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; data?: { id: string; name: string; expectedFileName: string; mimeType: string; size: number }; error?: string; loading: boolean } | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; error?: string } | null>(null);

  // SMTP state
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [smtpError, setSmtpError] = useState('');

  // --- Handlers ---
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

  const sendLoop = useCallback(async () => {
    setSendingState('sending');
    setSystemError('');
    pauseRequestedRef.current = false;

    while (true) {
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

        if (data.stopped) {
          if (data.stopReason === 'DAILY_LIMIT_REACHED') {
            setSendingState('daily_limit_reached');
          } else {
            setSendingState('completed');
          }
          setCurrentParticipant(null);
          return;
        }

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

  // --- Statistics & Derived State ---
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

  const isSending = sendingState === 'sending';
  const isPaused = sendingState === 'paused';
  const isIdle = sendingState === 'idle';
  const canStart = isIdle || sendingState === 'error';
  const canPause = isSending;
  const canResume = isPaused || sendingState === 'error';

  return (
    <div className="relative min-h-screen bg-background text-foreground font-sans pb-12 selection:bg-primary/20 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <GradientWaves
          horizonColor="#0c99c0"
          waveColor="#0ad2f1"
          crestColor="#FFFFFF"
          speed={0.65}
          amplitude={1.3}
          waveScale={1.45}
          waveRatio={0.3}
          swell={21.5}
          turbulence={28.5}
          tilt={1.1}
          zoom={0.7}
          height={5.5}
          fogDepth={15}
          detail="medium"
          brightness={1.0}
          opacity={1.0}
          mouseInteraction={false}
          parallaxStrength={0.53}
          grain={true}
          grainIntensity={0.12}
        />
      </div>

      <div className="relative z-10">
        {/* Premium Glassmorphic Header */}
        <header className="sticky top-0 z-10 bg-background/70 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 flex items-center gap-2">
              NexHack Automation
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Streamlined certificate delivery</p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {smtpStatus === 'success' && <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-500/20">SMTP Connected ✓</span>}
            {smtpStatus === 'error' && <span className="text-sm text-destructive font-medium bg-destructive/10 px-2 py-1 rounded-md border border-destructive/20" title={smtpError}>SMTP Error</span>}

            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifySMTP}
              disabled={isSending}
              className="bg-transparent"
            >
              {smtpStatus === 'testing' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Test SMTP
            </Button>

            {canPause && (
              <Button onClick={handlePause} variant="outline" className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 hover:dark:bg-amber-500/20 hover:text-amber-800 dark:hover:text-amber-300 border-amber-200 dark:border-amber-500/20">
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}

            {canResume && (
              <Button onClick={handleResume} variant="outline" className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 hover:dark:bg-emerald-500/20 hover:text-emerald-800 dark:hover:text-emerald-300 border-emerald-200 dark:border-emerald-500/20">
                <RotateCcw className="w-4 h-4 mr-2" />
                Resume
              </Button>
            )}

            {canStart && (
              <Button onClick={handleStart} className="bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/30">
                <Play className="w-4 h-4 mr-2 fill-current" />
                Start Sending
              </Button>
            )}

            {isSending && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-cyan-700 dark:text-cyan-400 bg-cyan-50/80 dark:bg-cyan-500/10 rounded-md font-medium border border-cyan-200 dark:border-cyan-500/20 shadow-sm animate-pulse">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-cyan-600 dark:border-cyan-400"></div>
                Sending...
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Animated Status Banners */}
        <AnimatePresence mode="popLayout">
          {sendingState === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              transition={{ duration: 0.3, type: "spring", bounce: 0 }}
            >
              <Alert className="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4 stroke-emerald-600 dark:stroke-emerald-400" />
                <AlertTitle>All participants processed.</AlertTitle>
                <AlertDescription>
                  Sent: {stats.sent} &middot; Failed: {stats.failed} &middot; Invalid Email: {stats.invalidEmail} &middot; Cert Not Found: {stats.certificateNotFound}
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          {sendingState === 'daily_limit_reached' && (
            <motion.div
              key="limit"
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Alert className="bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 stroke-amber-600 dark:stroke-amber-400" />
                <AlertTitle>Daily limit reached ({dailySent} / {dailyLimit})</AlertTitle>
                <AlertDescription>Sending has stopped. Resume manually on the next day.</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {sendingState === 'paused' && (
            <motion.div
              key="paused"
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Alert className="bg-yellow-50 dark:bg-amber-500/10 border-yellow-200 dark:border-amber-500/20 text-yellow-800 dark:text-amber-400">
                <Pause className="h-4 w-4 stroke-yellow-600 dark:stroke-amber-400" />
                <AlertTitle>Sending paused</AlertTitle>
                <AlertDescription>Click Resume to continue from the next unsent participant.</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {sendingState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                <XCircle className="h-4 w-4 stroke-destructive" />
                <AlertTitle>System error</AlertTitle>
                <AlertDescription>
                  <p>{systemError}</p>
                  <p className="mt-1 font-medium">Click Resume to retry.</p>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          {/* Current Processing Indicator */}
          {currentParticipant && isSending && (
            <motion.div
              key="current"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden relative">
                {/* Subtle animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 animate-pulse"></div>
                <CardContent className="p-4 flex items-center gap-4 relative z-10">
                  <div className="bg-primary/20 p-2 rounded-full">
                    <Zap className="w-5 h-5 text-primary shrink-0" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="font-semibold text-foreground truncate">
                        {currentParticipant.name || 'Processing...'}
                      </p>
                      {currentParticipant.email && (
                        <span className="text-sm font-medium text-muted-foreground">{currentParticipant.email}</span>
                      )}
                    </div>
                    <p className="text-sm text-primary mt-0.5 font-medium">{currentParticipant.action}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Staggered Statistics Cards */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <StatCard variants={itemVariants} title="Total" value={stats.total} icon={<Users className="text-blue-500 w-5 h-5" />} />
          <StatCard variants={itemVariants} title="Sent" value={stats.sent} icon={<CheckCircle className="text-emerald-500 w-5 h-5" />} />
          <StatCard variants={itemVariants} title="Pending" value={stats.pending} icon={<Clock className="text-amber-500 w-5 h-5" />} />
          <StatCard variants={itemVariants} title="Failed" value={stats.failed} icon={<XCircle className="text-red-500 w-5 h-5" />} />
          <StatCard variants={itemVariants} title="Invalid Email" value={stats.invalidEmail} icon={<AlertTriangle className="text-orange-500 w-5 h-5" />} />
          <StatCard variants={itemVariants} title="Cert Not Found" value={stats.certificateNotFound} icon={<FileX className="text-purple-500 w-5 h-5" />} />
          <StatCard
            variants={itemVariants}
            title="Today's Emails"
            value={dailySent}
            subtitle={`/ ${dailyLimit}`}
            icon={<Send className="text-indigo-500 w-5 h-5" />}
          />
        </motion.div>

        {/* Controls and Table */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search participants, emails or teams..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 bg-background shadow-sm border-border"
              />
            </div>

            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={(val) => {
                setStatusFilter(val || 'ALL');
                setCurrentPage(1);
              }}>
                <SelectTrigger className="bg-background shadow-sm border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter className="w-4 h-4" />
                    <SelectValue placeholder="Filter Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="INVALID_EMAIL">Invalid Email</SelectItem>
                  <SelectItem value="CERTIFICATE_NOT_FOUND">Cert Not Found</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ParticipantTable
            participants={paginatedParticipants}
            currentEmail={currentParticipant?.email}
            onTestCertificate={handleTestCertificate}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-card/50 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-border">
              <p className="text-sm text-muted-foreground font-medium">
                Showing <span className="text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, filteredParticipants.length)}</span> of <span className="text-foreground">{filteredParticipants.length}</span> results
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="bg-transparent"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="bg-transparent"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Test Certificate Modal using Shadcn Dialog */}
      <Dialog open={!!testingParticipant} onOpenChange={(open) => {
        if (!open) setTestingParticipant(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test Certificate</DialogTitle>
            <DialogDescription>
              Testing generation for <span className="font-medium text-foreground">{testingParticipant?.memberName}</span> from team <span className="font-medium text-foreground">{testingParticipant?.teamName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {testResult?.loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground font-medium">Generating certificate preview...</p>
              </div>
            ) : testResult?.success && testResult.data ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <Alert className="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20">
                  <CheckCircle className="h-4 w-4 stroke-emerald-600 dark:stroke-emerald-400" />
                  <AlertTitle className="text-emerald-800 dark:text-emerald-400">Certificate Found</AlertTitle>
                </Alert>

                <div className="bg-muted border border-border p-4 rounded-lg space-y-2 text-sm">
                  <p><span className="text-muted-foreground font-medium">File Name:</span> {testResult.data.name}</p>
                  <p><span className="text-muted-foreground font-medium">Expected Name:</span> {testResult.data.expectedFileName}</p>
                  <p><span className="text-muted-foreground font-medium">File Type:</span> {testResult.data.mimeType}</p>
                  <p><span className="text-muted-foreground font-medium">File Size:</span> {(testResult.data.size / 1024).toFixed(2)} KB</p>
                </div>

                <div className="pt-2">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Send Test Email</h4>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="recipient@example.com"
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                    />
                    <Button
                      onClick={handleSendTestEmail}
                      disabled={emailSending || !testEmailAddress || !/^\S+@\S+\.\S+$/.test(testEmailAddress)}
                    >
                      {emailSending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send
                    </Button>
                  </div>

                  {emailResult && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4">
                      {emailResult.success ? (
                        <Alert className="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 py-2">
                          <CheckCircle className="h-4 w-4 stroke-emerald-600 dark:stroke-emerald-400" />
                          <AlertTitle className="text-emerald-800 dark:text-emerald-400 text-sm m-0">Test email sent successfully!</AlertTitle>
                        </Alert>
                      ) : (
                        <Alert variant="destructive" className="py-2 bg-destructive/10 border-destructive/20 text-destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertTitle className="text-sm m-0">Failed to send: {emailResult.error}</AlertTitle>
                        </Alert>
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ) : testResult ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Certificate Not Found or Error</AlertTitle>
                  <AlertDescription>{testResult.error}</AlertDescription>
                </Alert>
              </motion.div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

// Subcomponents

function StatCard({ title, value, subtitle, icon, variants }: { title: string; value: number; subtitle?: string; icon: React.ReactNode, variants?: any }) {
  return (
    <motion.div variants={variants} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
      <Card className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow h-full bg-card/70 backdrop-blur-sm">
        <CardContent className="p-4 sm:p-5 flex items-start justify-between gap-2 h-full">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{title}</p>
            <p className="text-2xl font-bold text-foreground tracking-tight flex items-baseline gap-1">
              {value}
              {subtitle && <span className="text-sm font-medium text-muted-foreground">{subtitle}</span>}
            </p>
          </div>
          <div className="p-2.5 bg-muted rounded-xl shrink-0 border border-border">
            {icon}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
