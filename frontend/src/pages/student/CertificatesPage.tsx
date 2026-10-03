import { useEffect, useState } from 'react';
import axios from 'axios';
import { Award, Download, Eye } from 'lucide-react';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { studentDashboardService, type StudentCertificate } from '../../services/studentDashboard.service';

export function StudentCertificatesPage() {
  const [certificates, setCertificates] = useState<StudentCertificate[]>([]);
  const [verification, setVerification] = useState<Record<string, { loading: boolean; message?: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    studentDashboardService.getCertificates()
      .then((response) => { if (isMounted) setCertificates(response.data.certificates); })
      .catch((cause: unknown) => { if (isMounted) setError(axios.isAxiosError(cause) && cause.response?.status === 401 ? 'Your session has expired. Sign in again.' : 'Certificate records could not be loaded.'); })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const verify = async (certificateNumber: string) => {
    setVerification((state) => ({ ...state, [certificateNumber]: { loading: true } }));
    try {
      const response = await studentDashboardService.verifyCertificate(certificateNumber);
      setVerification((state) => ({ ...state, [certificateNumber]: { loading: false, message: `Certificate ${response.data.certificate.verificationStatus}.` } }));
    } catch (cause) {
      const message = axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data.message ?? 'Certificate verification is unavailable.' : 'Certificate verification is unavailable.';
      setVerification((state) => ({ ...state, [certificateNumber]: { loading: false, message } }));
    }
  };

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader title="Certificates" subtitle="Issued and pending credentials attached to your account." />
      {isLoading ? <p role="status" className="mb-5 text-sm text-[var(--color-muted)]">Loading certificates...</p> : null}
      {error ? <p role="alert" className="mb-5 text-sm text-[var(--color-primary)]">{error}</p> : null}
      {!isLoading && !error && certificates.length === 0 ? <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-sm text-[var(--color-muted)]">No certificates available yet.</p> : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{certificates.map((certificate) => {
        const verificationResult = verification[certificate.certificateId];
        const safeFileUrl = (() => {
          try {
            const parsedUrl = new URL(certificate.fileUrl ?? '');
            return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:' ? parsedUrl.href : null;
          } catch {
            return null;
          }
        })();
        return <Card key={certificate.id} className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div className="rounded-xl bg-[var(--color-background)] p-2 text-[var(--color-primary)]"><Award className="h-4 w-4" /></div><StatusBadge label={certificate.status === 'issued' ? 'Verified' : certificate.status} tone={certificate.status === 'issued' ? 'success' : certificate.status === 'pending' ? 'warning' : 'info'} /></div>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">{certificate.title}</h2><p className="mt-1 text-sm text-[var(--color-muted)]">Course: {certificate.course}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Certificate ID: {certificate.certificateId}</p><p className="mt-1 text-sm text-[var(--color-muted)]">Issued: {certificate.issueDate ? new Date(certificate.issueDate).toLocaleDateString() : 'Not issued'}</p>
          {certificate.status === 'issued' && safeFileUrl ? <div className="mt-5 flex flex-wrap gap-3"><a href={safeFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)]"><Eye className="h-4 w-4" /> View</a><a href={safeFileUrl} download className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)]"><Download className="h-4 w-4" /> Download</a></div> : <p className="mt-4 text-sm text-[var(--color-muted)]">{certificate.status === 'issued' ? 'No safe certificate document link is available.' : 'Certificate document is not available.'}</p>}
          <button type="button" disabled={certificate.status !== 'issued' || Boolean(verificationResult?.loading)} onClick={() => void verify(certificate.certificateId)} className="mt-4 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-green)] disabled:opacity-50">{verificationResult?.loading ? 'Verifying...' : 'Verify certificate'}</button>
          {verificationResult?.message ? <p role="status" className="mt-2 text-sm text-[var(--color-muted)]">{verificationResult.message}</p> : null}
        </Card>;
      })}</div>
    </div>
  );
}