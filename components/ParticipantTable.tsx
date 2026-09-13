import React from 'react';
import { CheckCircle2, Clock, AlertCircle, AlertTriangle, FileX, Search } from 'lucide-react';
import type { ParticipantStatus } from '@/lib/status';

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
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          SENT
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="w-3.5 h-3.5 mr-1" />
          PENDING
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3.5 h-3.5 mr-1" />
          FAILED
        </span>
      );
    case 'INVALID_EMAIL':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
          INVALID EMAIL
        </span>
      );
    case 'CERTIFICATE_NOT_FOUND':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <FileX className="w-3.5 h-3.5 mr-1" />
          CERT NOT FOUND
        </span>
      );
    default:
      return null;
  }
}

export default function ParticipantTable({ participants, currentEmail, onTestCertificate }: ParticipantTableProps) {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Team Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Member Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Member Email
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Phone Number
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {participants.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                No participants found.
              </td>
            </tr>
          ) : (
            participants.map((p, idx) => {
              const isActive = currentEmail === p.memberEmail;
              return (
                <tr
                  key={idx}
                  className={`transition-colors ${isActive ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {p.teamName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {p.memberName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {p.memberEmail || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {p.memberPhone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {onTestCertificate && (
                      <button
                        onClick={() => onTestCertificate(p)}
                        className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end gap-1 w-full"
                      >
                        <Search className="w-4 h-4" />
                        Test Cert
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
