import axios from 'axios';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CircleDollarSign, Pencil, Plus, Search } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { MetricCard } from '../../components/MetricCard';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { adminService, type AdminStudent } from '../../services/admin.service';
import { adminManagementService, type ManagedPayment } from '../../services/adminManagement.service';

type PaymentForm = {
  studentId: string;
  enrollmentId: string;
  amount: string;
  paymentMethod: NonNullable<ManagedPayment['paymentMethod']>;
  paymentDate: string;
  dueDate: string;
  status: ManagedPayment['status'];
  referenceId: string;
  receiptUrl: string;
};
const emptyForm: PaymentForm = { studentId: '', enrollmentId: '', amount: '', paymentMethod: 'upi', paymentDate: '', dueDate: '', status: 'pending', referenceId: '', receiptUrl: '' };

function apiError(error: unknown, fallback: string) {
  return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data.message ?? fallback : fallback;
}

function inr(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(value);
}

export function AdminPaymentsPage() {
  const [payments, setPayments] = useState<ManagedPayment[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [enrollments, setEnrollments] = useState<Array<{ id: number | string; studentId: number | string; studentName: string; courseId: number | string; course: string; batch: string }>>([]);
  const [revenue, setRevenue] = useState<Record<string, number | string>>({});
  const [period, setPeriod] = useState<'today' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<ManagedPayment | null>(null);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    const [paymentResponse, studentResponse, enrollmentResponse] = await Promise.all([
      adminManagementService.payments({ period, ...(period === 'custom' ? { startDate, endDate } : {}) }),
      adminService.getStudents(),
      adminManagementService.enrollments(),
    ]);
    setPayments(paymentResponse.data.payments);
    setRevenue(paymentResponse.data.revenue);
    setStudents(studentResponse.data.students);
    setEnrollments(enrollmentResponse.data.enrollments);
  };

  useEffect(() => {
    if (period === 'custom' && (!startDate || !endDate)) {
      setIsLoading(false);
      return;
    }
    let mounted = true;
    setIsLoading(true);
    setError('');
    Promise.all([
      adminManagementService.payments({ period, ...(period === 'custom' ? { startDate, endDate } : {}) }),
      adminService.getStudents(),
      adminManagementService.enrollments(),
    ])
      .then(([paymentResponse, studentResponse, enrollmentResponse]) => {
        if (!mounted) return;
        setPayments(paymentResponse.data.payments);
        setRevenue(paymentResponse.data.revenue);
        setStudents(studentResponse.data.students);
        setEnrollments(enrollmentResponse.data.enrollments);
      })
      .catch((cause: unknown) => { if (mounted) setError(apiError(cause, 'Payments could not be loaded.')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [period, startDate, endDate]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payments.filter((payment) => !query || [payment.studentName, payment.studentCode, payment.course ?? '', payment.referenceId ?? '', payment.paymentMethod ?? '', payment.status].some((value) => value.toLowerCase().includes(query)));
  }, [payments, search]);

  const openCreate = () => {
    setEditingPayment(null);
    setForm(emptyForm);
    setFormOpen(true);
    setError('');
  };

  const openEdit = (payment: ManagedPayment) => {
    setEditingPayment(payment);
    setForm({
      studentId: String(payment.studentId),
      enrollmentId: payment.enrollmentId === null ? '' : String(payment.enrollmentId),
      amount: String(payment.amount),
      paymentMethod: payment.paymentMethod ?? 'other',
      paymentDate: payment.paymentDate?.slice(0, 16) ?? '',
      dueDate: payment.dueDate ?? '',
      status: payment.status,
      referenceId: payment.referenceId ?? '',
      receiptUrl: payment.receiptUrl ?? '',
    });
    setFormOpen(true);
    setError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.studentId || !Number(form.amount) || Number(form.amount) <= 0) {
      setError('Choose a student and enter a positive payment amount.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        studentId: form.studentId,
        enrollmentId: form.enrollmentId || null,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate || null,
        dueDate: form.dueDate || null,
        status: form.status,
        referenceId: form.referenceId.trim(),
        receiptUrl: form.receiptUrl.trim(),
      };
      if (editingPayment) await adminManagementService.updatePayment(editingPayment.id, payload);
      else await adminManagementService.createPayment(payload);
      await load();
      setFormOpen(false);
      setNotice(editingPayment ? 'Payment record updated.' : 'Payment recorded in INR.');
    } catch (cause) {
      setError(apiError(cause, 'Payment could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  };

  const amount = (name: string) => Number(revenue[name] ?? 0);
  const studentEnrollments = enrollments.filter((item) => String(item.studentId) === form.studentId);

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader title="Payments & Revenue" subtitle="Record real payment obligations and receipts in Indian Rupees." action={<Button variant="primary" onClick={openCreate}><Plus className="h-4 w-4" /> Record payment</Button>} />
      {error ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm">{error}</p> : null}
      {notice ? <p role="status" className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm">{notice}</p> : null}

      <div className="mb-5 grid gap-3 lg:grid-cols-[auto_1fr]">
        <select aria-label="Revenue date filter" value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm">
          <option value="today">Today</option><option value="month">This Month</option><option value="quarter">This Quarter</option><option value="year">This Year</option><option value="custom">Custom Date Range</option>
        </select>
        {period === 'custom' ? <div className="flex flex-wrap gap-2"><Input label="From" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /><Input label="To" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></div> : null}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Revenue Collected" value={inr(amount('collected'))} note="INR payments in selected period" icon={<CircleDollarSign className="h-4 w-4" />} />
        <MetricCard label="Pending Amount" value={inr(amount('pending'))} note="Pending INR payment records" icon={<CircleDollarSign className="h-4 w-4" />} />
        <MetricCard label={period === 'today' ? 'Today' : period === 'quarter' ? 'This Quarter' : period === 'year' ? 'This Year' : 'This Month'} value={inr(amount(period === 'today' ? 'today' : period === 'quarter' ? 'thisQuarter' : period === 'year' ? 'thisYear' : 'thisMonth'))} note="Paid INR payments" icon={<CircleDollarSign className="h-4 w-4" />} />
      </div>

      <div className="mb-4 flex max-w-lg items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
        <Search className="h-4 w-4 text-[var(--color-primary)]" /><input aria-label="Search payments" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, course, method, reference" className="w-full bg-transparent text-sm outline-none" />
      </div>

      <Card className="p-4 md:p-5">
        {isLoading ? <p role="status" className="py-4 text-sm text-[var(--color-muted)]">Loading MySQL payment records...</p> : null}
        {!isLoading && visible.length === 0 ? <p className="py-6 text-center text-sm text-[var(--color-muted)]">{search ? 'No payments match your search.' : 'No payment records in this date range.'}</p> : null}
        {visible.length > 0 ? <div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-sm">
          <thead><tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]"><th className="pb-3 pr-4">Student</th><th className="pb-3 pr-4">Course</th><th className="pb-3 pr-4">Amount</th><th className="pb-3 pr-4">Method</th><th className="pb-3 pr-4">Date / Due</th><th className="pb-3 pr-4">Status</th><th className="pb-3 pr-4">Reference</th><th className="pb-3">Action</th></tr></thead>
          <tbody>{visible.map((payment) => <tr key={payment.id} className="border-b border-[var(--color-border)] last:border-0">
            <td className="py-3 pr-4"><span className="block font-medium">{payment.studentName}</span><span className="text-xs text-[var(--color-muted)]">{payment.studentCode}</span></td>
            <td className="py-3 pr-4">{payment.course ?? 'Unassigned'}</td><td className="py-3 pr-4 font-semibold">{inr(payment.amount)}</td><td className="py-3 pr-4">{payment.paymentMethod?.replace('_', ' ') ?? 'Not recorded'}</td>
            <td className="py-3 pr-4">{payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-IN') : '—'}{payment.dueDate ? <span className="block text-xs text-[var(--color-muted)]">Due {new Date(`${payment.dueDate}T00:00:00`).toLocaleDateString('en-IN')}</span> : null}</td>
            <td className="py-3 pr-4"><StatusBadge label={payment.status} tone={payment.status === 'paid' ? 'success' : payment.status === 'pending' ? 'warning' : 'info'} /></td><td className="py-3 pr-4">{payment.referenceId ?? '—'}</td>
            <td className="py-3"><Button variant="ghost" size="sm" aria-label={`Edit payment ${payment.id}`} onClick={() => openEdit(payment)}><Pencil className="h-4 w-4" /></Button></td>
          </tr>)}</tbody>
        </table></div> : null}
      </Card>

      <Modal isOpen={formOpen} title={editingPayment ? 'Edit payment record' : 'Record payment'} onClose={() => setFormOpen(false)}>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-medium">Student<select required value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value, enrollmentId: '' })} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.fullName} · {student.studentId}</option>)}</select></label>
          <label className="block text-sm font-medium">Course enrollment<select value={form.enrollmentId} onChange={(event) => setForm({ ...form, enrollmentId: event.target.value })} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"><option value="">No course selected</option>{studentEnrollments.map((item) => <option key={item.id} value={item.id}>{item.course} · {item.batch}</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Amount (₹ INR)" type="number" min="0.01" max="9999999999.99" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
            <label className="block text-sm font-medium">Payment method<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as NonNullable<ManagedPayment['paymentMethod']> })} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"><option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select></label>
            <Input label="Payment date" type="date" value={form.paymentDate.slice(0, 10)} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} />
            <Input label="Due date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            <label className="block text-sm font-medium">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ManagedPayment['status'] })} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></label>
            <Input label="Reference" value={form.referenceId} onChange={(event) => setForm({ ...form, referenceId: event.target.value })} maxLength={150} />
          </div>
          <Input label="Receipt URL (optional)" type="url" value={form.receiptUrl} onChange={(event) => setForm({ ...form, receiptUrl: event.target.value })} maxLength={2048} />
          <p className="text-xs text-[var(--color-muted)]">No tax or gateway fees are calculated. Newly recorded payment amounts are stored as INR.</p>
          <div className="flex justify-end gap-2"><Button variant="outline" type="button" onClick={() => setFormOpen(false)}>Cancel</Button><Button variant="primary" type="submit" loading={isSaving}>{editingPayment ? 'Save changes' : 'Record payment'}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
