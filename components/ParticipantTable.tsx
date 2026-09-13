import React from 'react';
import { Participant } from '@/lib/excel';
import { CheckCircle2, Clock, AlertCircle, AlertTriangle, Search } from 'lucide-react';

interface ParticipantTableProps {
  participants: Participant[];
  onTestCertificate?: (participant: Participant) => void;
}

export default function ParticipantTable({ participants, onTestCertificate }: ParticipantTableProps) {
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
            participants.map((p, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {p.teamName || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {p.memberName || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center space-x-2">
                    <span className={!p.isValidEmail && p.memberEmail ? 'text-red-600 font-medium' : 'text-gray-700'}>
                      {p.memberEmail || '-'}
                    </span>
                    {!p.isValidEmail && p.memberEmail && (
                      <span title="Invalid Email Format">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {p.memberPhone || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {p.status === 'SENT' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      SENT
                    </span>
                  )}
                  {p.status === 'PENDING' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      PENDING
                    </span>
                  )}
                  {p.status === 'FAILED' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <AlertCircle className="w-3.5 h-3.5 mr-1" />
                      FAILED
                    </span>
                  )}
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
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
