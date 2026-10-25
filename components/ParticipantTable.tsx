import React from 'react';
import { CheckCircle2, Clock, AlertCircle, AlertTriangle, FileX, Search } from 'lucide-react';
import type { ParticipantStatus } from '@/lib/status';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface Participant {
  teamName: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  status: ParticipantStatus;
}

interface ParticipantTableProps {
  participants: Participant[];
  currentEmail?: string;
  onTestCertificate?: (participant: Participant) => void;
}

function StatusBadge({ status }: { status: ParticipantStatus }) {
  switch (status) {
    case 'SENT':
      return (
        <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          SENT
        </Badge>
      );
    case 'PENDING':
      return (
        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20">
          <Clock className="w-3 h-3 mr-1" />
          PENDING
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
          <AlertCircle className="w-3 h-3 mr-1" />
          FAILED
        </Badge>
      );
    case 'INVALID_EMAIL':
      return (
        <Badge variant="outline" className="bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          INVALID EMAIL
        </Badge>
      );
    case 'CERTIFICATE_NOT_FOUND':
      return (
        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20">
          <FileX className="w-3 h-3 mr-1" />
          CERT NOT FOUND
        </Badge>
      );
    default:
      return null;
  }
}

export default function ParticipantTable({ participants, currentEmail, onTestCertificate }: ParticipantTableProps) {
  return (
    <div className="rounded-xl border border-border backdrop-blur-sm shadow-sm bg-zinc-900/80 overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/80">
          <TableRow>
            <TableHead className="font-semibold text-muted-foreground">Team Name</TableHead>
            <TableHead className="font-semibold text-muted-foreground">Member Name</TableHead>
            <TableHead className="font-semibold text-muted-foreground">Member Email</TableHead>
            <TableHead className="font-semibold text-muted-foreground">Phone Number</TableHead>
            <TableHead className="font-semibold text-muted-foreground">Status</TableHead>
            <TableHead className="text-right font-semibold text-muted-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence initial={false}>
            {participants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No participants found.
                </TableCell>
              </TableRow>
            ) : (
              participants.map((p,id) => {
                const isActive = currentEmail === p.memberEmail;
                return (
                  <motion.tr
                    key={p.memberEmail + p.teamName + p.memberName + id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, backgroundColor: isActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0)' }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={`border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${isActive ? 'ring-1 ring-inset ring-primary/20' : ''}`}
                  >
                    <TableCell className="font-medium text-foreground">{p.teamName || '-'}</TableCell>
                    <TableCell className="text-foreground">{p.memberName || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{p.memberEmail || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{p.memberPhone || '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {onTestCertificate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onTestCertificate(p)}
                          className="text-muted-foreground hover:text-primary h-8"
                        >
                          <Search className="w-4 h-4 mr-2" />
                          Test Cert
                        </Button>
                      )}
                    </TableCell>
                  </motion.tr>
                );
              })
            )}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
}
