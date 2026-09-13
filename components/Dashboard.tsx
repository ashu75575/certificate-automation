"use client";

import React, { useState, useMemo } from 'react';
import { Participant } from '@/lib/excel';
import ParticipantTable from './ParticipantTable';
import { Search, Filter, Play, Pause, RotateCcw, Users, CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';

interface DashboardProps {
  initialParticipants: Participant[];
}

const ITEMS_PER_PAGE = 50;

export default function Dashboard({ initialParticipants }: DashboardProps) {
  const [participants] = useState<Participant[]>(initialParticipants);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

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
          <div className="flex gap-3">
            <button disabled className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-md font-medium cursor-not-allowed">
              <Pause className="w-4 h-4" /> Pause
            </button>
            <button disabled className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-md font-medium cursor-not-allowed">
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

          <ParticipantTable participants={paginatedParticipants} />

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
