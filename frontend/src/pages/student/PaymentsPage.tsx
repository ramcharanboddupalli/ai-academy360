import { useEffect, useState } from 'react';
import axios from 'axios';
import { WalletCards } from 'lucide-react';
import { Card } from '../../components/Card';
import { MetricCard } from '../../components/MetricCard';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { studentService, type StudentCourse } from '../../services/student.service';
import { studentDashboardService, type StudentPayment } from '../../services/studentDashboard.service';

function amount(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
}

export function StudentPaymentsPage() {
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [totals, setTotals] = useState<Record<string, { total: number; paid: number; pending: number }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    Promise.all([studentService.getCourses(), studentDashboardService.getPayments()])
      .then(([courseResponse, paymentResponse]) => {
        if (!isMounted) return;
        setCourses(courseResponse.data.courses);
        setPayments(paymentResponse.data.payments);
        setTotals(paymentResponse.data.totalsByCurrency);
      })
      .catch((cause: unknown) => { if (isMounted) setError(axios.isAxiosError(cause) && cause.response?.status === 401 ? 'Your session has expired. Sign in again.' : 'Enrollment and payment information could not be loaded.'); })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader title="Enrollment & Payments" subtitle="Your enrolled courses and payment records." />
      {isLoading ? <p role="status" className="mb-5 text-sm text-[var(--color-muted)]">Loading enrollment and payment records...</p> : null}
      {error ? <p role="alert" className="mb-5 text-sm text-[var(--color-primary)]">{error}</p> : null}
      {!isLoading && !error ? <>
        <Card className="p-5"><h2 className="font-semibold text-[var(--color-text)]">Enrollment</h2>{courses.length ? <div className="mt-3 divide-y divide-[var(--color-border)]">{courses.map((course) => <div key={course.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"><span><span className="block font-medium text-[var(--color-text)]">{course.name}</span><span className="mt-1 block text-sm text-[var(--color-muted)]">Enrolled {new Date(course.enrollmentDate).toLocaleDateString()}</span></span><StatusBadge label={course.status} /></div>)}</div> : <p className="mt-3 text-sm text-[var(--color-muted)]">No courses have been assigned to your account yet.</p>}</Card>

        <section className="mt-6"><h2 className="mb-3 font-semibold text-[var(--color-text)]">Payment Summary</h2>{Object.keys(totals).length ? <div className="grid gap-4 md:grid-cols-3">{Object.entries(totals).map(([currency, values]) => <div key={currency} className="contents"><MetricCard label={`Total Fees (${currency})`} value={amount(values.total, currency)} note="Recorded payment obligations" icon={<WalletCards className="h-4 w-4" />} /><MetricCard label="Paid" value={amount(values.paid, currency)} note="Recorded as paid" icon={<WalletCards className="h-4 w-4" />} /><MetricCard label="Pending" value={amount(values.pending, currency)} note="Recorded as pending" icon={<WalletCards className="h-4 w-4" />} /></div>)}</div> : <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-muted)]">No payment records available.</p>}</section>

        <Card className="mt-6 p-5"><h2 className="font-semibold text-[var(--color-text)]">Payment History</h2>{payments.length ? <div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]"><th className="pb-3 pr-4">Course</th><th className="pb-3 pr-4">Amount</th><th className="pb-3 pr-4">Method</th><th className="pb-3 pr-4">Payment Date / Due</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Reference</th><th className="pb-3">Receipt</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-[var(--color-border)] last:border-0"><td className="py-3 pr-4">{payment.course ?? 'Enrollment'}</td><td className="py-3 pr-4">{amount(payment.amount, payment.currency)}</td><td className="py-3 pr-4">{payment.paymentMethod?.replace('_', ' ') ?? '—'}</td><td className="py-3 pr-4">{payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-IN') : 'Not recorded'}{payment.dueDate ? <span className="block text-xs text-[var(--color-muted)]">Due {new Date(`${payment.dueDate}T00:00:00`).toLocaleDateString('en-IN')}</span> : null}</td><td className="py-3 pr-4"><StatusBadge label={payment.status} tone={payment.status === 'paid' ? 'success' : payment.status === 'pending' ? 'warning' : 'info'} /></td><td className="py-3 pr-4">{payment.referenceId ?? 'Not available'}</td><td className="py-3">{payment.receiptUrl ? <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="font-medium text-[var(--color-primary)]">View receipt</a> : 'Not available'}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-[var(--color-muted)]">No payment records available.</p>}</Card>
      </> : null}
    </div>
  );
}