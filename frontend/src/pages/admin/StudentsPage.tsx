import axios from 'axios';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Eye, Pencil, Plus, Search, UserRoundX, Users } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { adminService, type AdminCourse, type AdminStudent, type StudentPayload } from '../../services/admin.service';
import { adminManagementService } from '../../services/adminManagement.service';

type StudentFormValues = Omit<StudentPayload, 'password'> & { password: string };
type ModalMode = 'create' | 'edit' | 'view';

const emptyForm: StudentFormValues = {
  fullName: '',
  email: '',
  phone: '',
  courseIds: [],
  batch: '',
  joinDate: '',
  password: '',
};

function getApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(error) && error.response?.data.message) {
    return error.response.data.message;
  }
  return fallback;
}

function toFormValues(student: AdminStudent): StudentFormValues {
  return {
    fullName: student.fullName,
    email: student.email,
    phone: student.phone,
    courseIds: student.courses?.length ? student.courses.map((course) => course.id) : [student.courseId],
    batch: student.batch,
    joinDate: student.joinDate,
    password: '',
  };
}

export function AdminStudentsPage() {
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<AdminStudent | null>(null);
  const [formValues, setFormValues] = useState<StudentFormValues>(emptyForm);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingStudentId, setUpdatingStudentId] = useState<number | string | null>(null);
  const [student360, setStudent360] = useState<Awaited<ReturnType<typeof adminManagementService.student360>>['data'] | null>(null);
  const [student360Loading, setStudent360Loading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'name'>('newest');

  const loadStudents = async () => {
    const response = await adminService.getStudents();
    setStudents(response.data.students);
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([adminService.getStudents(), adminService.getCourses()])
      .then(([studentResponse, courseResponse]) => {
        if (!isMounted) return;
        setStudents(studentResponse.data.students);
        setCourses(courseResponse.data.courses);
      })
      .catch((error: unknown) => {
        if (isMounted) setPageError(getApiError(error, 'Student records could not be loaded.'));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const visibleStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const result = students.filter((student) =>
      (statusFilter === 'all' || student.status === statusFilter) &&
      (!query ||
      [student.studentId, student.fullName, student.email, student.course, student.batch]
        .some((value) => value.toLowerCase().includes(query))),
    );
    if (sortOrder === 'name') return result.sort((a, b) => a.fullName.localeCompare(b.fullName));
    return result;
  }, [searchTerm, sortOrder, statusFilter, students]);

  const openCreateModal = () => {
    setSelectedStudent(null);
    setStudent360(null);
    setFormValues(emptyForm);
    setFormError('');
    setModalMode('create');
  };

  const openStudentModal = async (student: AdminStudent, mode: Exclude<ModalMode, 'create'>) => {
    setSelectedStudent(student);
    setFormValues(toFormValues(student));
    setFormError('');
    setModalMode(mode);
    if (mode === 'view') {
      setStudent360Loading(true);
      try {
        const response = await adminManagementService.student360(student.id);
        setStudent360(response.data);
        setSelectedStudent(response.data.student);
        setFormValues(toFormValues(response.data.student));
      } catch (error) {
        setFormError(getApiError(error, 'Student details could not be loaded.'));
      } finally {
        setStudent360Loading(false);
      }
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedStudent(null);
    setStudent360(null);
    setFormError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modalMode || modalMode === 'view') return;
    if (formValues.courseIds.length === 0) {
      setFormError('Select at least one course.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    setSuccessMessage('');
    try {
      const payload: StudentPayload = {
        fullName: formValues.fullName,
        email: formValues.email,
        phone: formValues.phone,
        courseIds: formValues.courseIds,
        batch: formValues.batch,
        joinDate: formValues.joinDate,
        ...(modalMode === 'create' ? { password: formValues.password } : {}),
      };
      const response = modalMode === 'create'
        ? await adminService.createStudent(payload)
        : await adminService.updateStudent(selectedStudent!.id, payload);
      await loadStudents();
      if (modalMode === 'create') {
        setSuccessMessage(`Student account created. Provide Student ID ${response.data.student.studentId} and the initial password to the student.`);
      }
      closeModal();
    } catch (error) {
      setFormError(getApiError(error, 'Student account could not be saved.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStudentStatus = async (student: AdminStudent) => {
    setUpdatingStudentId(student.id);
    setPageError('');
    try {
      const status = student.status === 'Active' ? 'Inactive' : 'Active';
      const response = await adminService.updateStudentStatus(student.id, status);
      setStudents((current) => current.map((item) => item.id === student.id ? response.data.student : item));
    } catch (error) {
      setPageError(getApiError(error, 'Student status could not be updated.'));
    } finally {
      setUpdatingStudentId(null);
    }
  };

  const isReadOnly = modalMode === 'view';
  const modalTitle = modalMode === 'create' ? 'Create Student Account' : modalMode === 'edit' ? 'Edit Student Account' : 'Student Details';

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader
        title="Students"
        subtitle="Management creates student accounts and provides each learner with their Student ID and initial password."
        action={<Button variant="primary" onClick={openCreateModal}><Plus className="h-4 w-4" /> Add Student</Button>}
      />

      {pageError ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm text-[var(--color-text)]">{pageError}</p> : null}
      {successMessage ? <p role="status" className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm text-[var(--color-text)]">{successMessage}</p> : null}

      <div className="mb-5 flex max-w-md items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-muted)]">
        <Search className="h-4 w-4 text-[var(--color-primary)]" />
        <input
          aria-label="Search students"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search students"
          className="w-full bg-transparent text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)]"
        />
      </div>
      <div className="mb-5 flex flex-wrap gap-3">
        <label className="text-sm text-[var(--color-muted)]">Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="ml-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-[var(--color-text)]"><option value="all">All</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
        </label>
        <label className="text-sm text-[var(--color-muted)]">Sort
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)} className="ml-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-[var(--color-text)]"><option value="newest">Recently created</option><option value="name">Name</option></select>
        </label>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-[var(--color-background)] p-2 text-[var(--color-primary)]"><Users className="h-4 w-4" /></div>
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">Student records</h3>
            <p className="text-xs text-[var(--color-muted)]">Student accounts and changes are stored in the academy database.</p>
          </div>
        </div>

        <div className="min-w-0 max-w-[calc(100vw-6rem)] overflow-x-auto md:max-w-full">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="pb-3 pr-4 font-medium">Student ID</th>
                <th className="pb-3 pr-4 font-medium">Student Name</th>
                <th className="pb-3 pr-4 font-medium">Email</th>
                <th className="pb-3 pr-4 font-medium">Course</th>
                <th className="pb-3 pr-4 font-medium">Batch</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => (
                <tr key={student.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="whitespace-nowrap py-3 pr-4 font-semibold text-[var(--color-text)]">{student.studentId}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-[var(--color-text)]">{student.fullName}</td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">{student.email}</td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">{student.courses.length ? student.courses.map((course) => course.name).join(', ') : 'No assigned courses'}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-[var(--color-muted)]">{student.batch}</td>
                  <td className="py-3 pr-4"><StatusBadge label={student.status} tone={student.status === 'Active' ? 'success' : 'warning'} /></td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" aria-label={`View ${student.fullName}`} title="View" onClick={() => void openStudentModal(student, 'view')}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Edit ${student.fullName}`} title="Edit" onClick={() => void openStudentModal(student, 'edit')}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`${student.status === 'Active' ? 'Deactivate' : 'Activate'} ${student.fullName}`} title={student.status === 'Active' ? 'Deactivate' : 'Activate'} loading={updatingStudentId === student.id} onClick={() => void toggleStudentStatus(student)}><UserRoundX className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && visibleStudents.length === 0 ? (
                <tr><td className="py-6 text-center text-[var(--color-muted)]" colSpan={7}>{searchTerm ? 'No students match your search.' : 'No student accounts have been created yet.'}</td></tr>
              ) : null}
              {isLoading ? <tr><td className="py-6 text-center text-[var(--color-muted)]" colSpan={7}>Loading student records...</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={modalMode !== null} title={modalTitle} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
            <p className="text-xs font-medium text-[var(--color-muted)]">Generated Student ID</p>
            <p className="mt-1 font-semibold text-[var(--color-text)]">{modalMode === 'create' ? 'Assigned by the server after successful creation' : selectedStudent?.studentId}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">The academy assigns the unique Student ID when this account is created.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full Name" value={formValues.fullName} onChange={(event) => setFormValues({ ...formValues, fullName: event.target.value })} required readOnly={isReadOnly} />
            <Input label="Email" type="email" value={formValues.email} onChange={(event) => setFormValues({ ...formValues, email: event.target.value })} required readOnly={isReadOnly} />
            <Input label="Phone" type="tel" value={formValues.phone} onChange={(event) => setFormValues({ ...formValues, phone: event.target.value })} required readOnly={isReadOnly} />
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 block text-sm font-medium text-[var(--color-text)]">Course / Courses (select at least one)</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {courses.map((course) => (
                  <label key={course.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]">
                    <input
                      type="checkbox"
                      checked={formValues.courseIds.some((id) => String(id) === String(course.id))}
                      disabled={isReadOnly}
                      onChange={(event) => setFormValues((current) => ({
                        ...current,
                        courseIds: event.target.checked
                          ? [...current.courseIds, course.id]
                          : current.courseIds.filter((id) => String(id) !== String(course.id)),
                      }))}
                    />
                    <span>{course.name}</span>
                  </label>
                ))}
              </div>
              {courses.length === 0 ? <p className="mt-2 text-sm text-[var(--color-muted)]">No active courses are available to assign.</p> : null}
            </fieldset>
            <Input label="Batch" value={formValues.batch} onChange={(event) => setFormValues({ ...formValues, batch: event.target.value })} required readOnly={isReadOnly} />
            <Input label="Join Date" type="date" value={formValues.joinDate} onChange={(event) => setFormValues({ ...formValues, joinDate: event.target.value })} required readOnly={isReadOnly} />
          </div>

          {modalMode === 'create' ? (
            <div>
              <Input label="Initial Password" type="password" value={formValues.password} onChange={(event) => setFormValues({ ...formValues, password: event.target.value })} placeholder="Enter an initial password" required autoComplete="new-password" minLength={8} maxLength={72} />
              <p className="mt-2 text-xs text-[var(--color-muted)]">Management provides the server-assigned Student ID and initial password to the student. The password is sent securely and stored only as a bcrypt hash.</p>
            </div>
          ) : null}

          {isReadOnly ? <section className="space-y-4 border-t border-[var(--color-border)] pt-4">
            {student360Loading ? <p role="status" className="text-sm text-[var(--color-muted)]">Loading Student 360 records...</p> : null}
            {student360 ? <>
              <div><h3 className="font-semibold">Enrolled courses & progress</h3>{student360.courses.map((course) => {
                const progress = student360.progress.find((item) => item.course === course.name);
                return <p key={course.id} className="mt-1 text-sm text-[var(--color-muted)]">{course.name} · {course.status} · {progress?.progress == null ? 'Progress not recorded' : `${progress.progress}%`}{progress?.currentTopic ? ` · ${progress.currentTopic}` : ''}</p>;
              })}</div>
              <div><h3 className="font-semibold">Attendance</h3>{student360.attendance.length ? student360.attendance.map((row) => <p key={row.course} className="mt-1 text-sm text-[var(--color-muted)]">{row.course} · {row.attendedClasses}/{row.recordedClasses} · {row.attendancePercent ?? '—'}%</p>) : <p className="mt-1 text-sm text-[var(--color-muted)]">No attendance recorded.</p>}</div>
              <div><h3 className="font-semibold">Payments</h3>{student360.payments.map((row) => <p key={row.id} className="mt-1 text-sm text-[var(--color-muted)]">{row.course ?? 'Enrollment'} · {new Intl.NumberFormat('en-IN', { style: 'currency', currency: row.currency }).format(row.amount)} · {row.status}</p>)}</div>
              <div><h3 className="font-semibold">Certificates & internships</h3>{student360.certificates.map((row) => <p key={row.id} className="mt-1 text-sm text-[var(--color-muted)]">{row.course} · {row.certificateId} · {row.status}</p>)}{student360.internships.map((row) => <p key={`${row.title}-${row.organization}`} className="mt-1 text-sm text-[var(--color-muted)]">{row.title} · {row.organization} · {row.status}</p>)}</div>
              <div><h3 className="font-semibold">Complaints</h3>{student360.tickets.map((row) => <p key={row.ticketNumber} className="mt-1 text-sm text-[var(--color-muted)]">{row.ticketNumber} · {row.title} · {row.priority} · {row.status}</p>)}</div>
              <div><h3 className="font-semibold">Recent activity</h3>{student360.recentActivity.map((row, index) => <p key={`${row.activity}-${index}`} className="mt-1 text-sm text-[var(--color-muted)]">{row.activity} · {new Date(row.occurredAt).toLocaleString()}</p>)}</div>
            </> : null}
          </section> : null}

          {formError ? <p role="alert" className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-background)] p-3 text-sm text-[var(--color-text)]">{formError}</p> : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeModal}>{isReadOnly ? 'Close' : 'Cancel'}</Button>
            {!isReadOnly ? <Button type="submit" variant="primary" loading={isSubmitting}>{modalMode === 'create' ? 'Create Student' : 'Save Changes'}</Button> : null}
          </div>
        </form>
      </Modal>
    </div>
  );
}
