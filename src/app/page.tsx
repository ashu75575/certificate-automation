"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PreviewRecord {
  teamName: string;
  memberName: string;
  memberEmail: string;
  phone: string;
  status: string;
  isDuplicate: boolean;
  isAlreadySent: boolean;
  isInvalid: boolean;
}

interface PreviewData {
  summary: {
    total: number;
    valid: number;
    pending: number;
    alreadySent: number;
    invalid: number;
    duplicates: number;
  };
  records: PreviewRecord[];
}

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setPreviewData(null);
    try {
      const res = await fetch("/api/import/preview", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch preview");
      }
      setPreviewData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previewData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to commit data");
      }
      setSuccess(
        `Imported successfully! Created Batch: ${data.batch.name} with ${data.insertedCount} participants.`
      );
      setPreviewData(null); // Clear preview on success
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (record: PreviewRecord) => {
    if (record.isInvalid) return <Badge variant="destructive">Invalid</Badge>;
    if (record.isAlreadySent) return <Badge variant="secondary">Sent</Badge>;
    if (record.isDuplicate) return <Badge variant="outline" className="text-amber-600 border-amber-600">Duplicate</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 shadow-none border-0">Valid</Badge>;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex justify-center items-start pt-16">
      <div className="max-w-6xl w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Certificate Automation
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Manage your participants and imports seamlessly.
          </p>
        </div>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-white rounded-t-xl">
            <CardTitle className="flex items-center gap-2 text-xl">
              <FileSpreadsheet className="w-5 h-5 text-slate-600" />
              Local Excel Import
            </CardTitle>
            <CardDescription className="text-sm">
              Preview and import participants from the{" "}
              <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-xs">
                data/test_participants.xlsx
              </code>{" "}
              file in your codebase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6 bg-white rounded-b-xl">
            {!previewData && (
              <Button
                onClick={handlePreview}
                disabled={loading}
                className="w-full sm:w-auto shadow-sm"
              >
                {loading ? "Loading..." : "Preview Import"}
              </Button>
            )}

            {error && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800 animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="h-4 w-4 !text-green-600" />
                <AlertTitle className="text-green-800">Success</AlertTitle>
                <AlertDescription className="text-green-700">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            {previewData && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                  <Card className="shadow-none border-slate-200 bg-slate-50/50">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Total Rows
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold text-slate-900">
                        {previewData.summary.total}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none border-slate-200 bg-emerald-50/30">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="text-xs font-semibold uppercase tracking-wider text-emerald-600/80">
                        Valid
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold text-emerald-600">
                        {previewData.summary.valid}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none border-slate-200 bg-blue-50/30">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600/80">
                        Pending
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold text-blue-600">
                        {previewData.summary.pending}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none border-slate-200 bg-slate-50/50">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Already Sent
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold text-slate-900">
                        {previewData.summary.alreadySent}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none border-slate-200 bg-rose-50/30">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="text-xs font-semibold uppercase tracking-wider text-rose-600/80">
                        Invalid
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold text-rose-600">
                        {previewData.summary.invalid}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-none border-slate-200 bg-amber-50/30">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="text-xs font-semibold uppercase tracking-wider text-amber-600/80">
                        Duplicates
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="text-2xl font-bold text-amber-600">
                        {previewData.summary.duplicates}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-md border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-[150px]">Team</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.records.length > 0 ? (
                        previewData.records.map((record, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium text-slate-700">
                              {record.teamName || <span className="text-slate-400 italic">None</span>}
                            </TableCell>
                            <TableCell className="text-slate-900">{record.memberName}</TableCell>
                            <TableCell className="text-slate-600">{record.memberEmail}</TableCell>
                            <TableCell className="text-slate-500 text-sm">
                              {record.phone || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {getStatusBadge(record)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                            No records found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleCommit}
                    disabled={loading || previewData.summary.valid === 0}
                    size="lg"
                    className="w-full sm:w-auto shadow-sm"
                  >
                    {loading ? "Committing..." : "Confirm & Import"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPreviewData(null)}
                    disabled={loading}
                    size="lg"
                    className="w-full sm:w-auto text-slate-600"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
