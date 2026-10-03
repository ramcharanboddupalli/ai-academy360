import axios from 'axios';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BookOpen, Eye, Pencil, Plus, Search, UserMinus, UserPlus } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { adminService, type AdminStudent } from '../../services/admin.service';
import { adminManagementService, type ManagedCourse } from '../../services/adminManagement.service';

type CourseForm = { code: string; title: string; description: string; instructor: string };
const emptyForm: CourseForm = { code: '', title: '', description: '', instructor: '' };

function errorText(error: unknown, fallback: string) {
  return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data.message ?? fallback : fallback;
}

export function AdminCoursesPage() {
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeCourse, setActiveCourse] = useState<ManagedCourse | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [courseStudents, setCourseStudents] = useState<Array<AdminStudent & { enrollmentStatus: string; batch: string; enrollmentDate: string }>>([]);
  const [formCourse, setFormCourse] = useState<ManagedCourse | null>(null);
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [isRosterLoading, setIsRosterLoading] = useState(false);

  const load = async () => {
    const [courseResponse, studentResponse] = await Promise.all([adminManagementService.courses(), adminService.getStudents()]);
    setCourses(courseResponse.data.courses);
    setStudents(studentResponse.data.students);
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([adminManagementService.courses(), adminService.getStudents()])
      .then(([courseResponse, studentResponse]) => {
        if (!mounted) return;
        setCourses(courseResponse.data.courses);
        setStudents(studentResponse.data.students);
      })
      .catch((cause: unknown) => { if (mounted) setError(errorText(cause, 'Courses could not be loaded.')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) => !query || [course.code, course.title, course.instructor ?? '', course.description ?? ''].some((value) => value.toLowerCase().includes(query)));
  }, [courses, search]);

  const showRoster = async (course: ManagedCourse) => {
    setActiveCourse(course);
    setCourseStudents([]);
    setSelectedStudent('');
    setIsRosterLoading(true);
    setError('');
    try {
      const response = await adminManagementService.courseStudents(course.id);
      setCourseStudents(response.data.students as typeof courseStudents);
    } catch (cause) {
      setError(errorText(cause, 'Course enrollment list could not be loaded.'));
    } finally {
      setIsRosterLoading(false);
    }
  };

  const openForm = (course?: ManagedCourse) => {
    setFormCourse(course ?? null);
    setForm(course ? { code: course.code, title: course.title, description: course.description ?? '', instructor: course.instructor ?? '' } : emptyForm);
    setIsFormOpen(true);
    setError('');
  };

  const saveCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const payload = { ...form, code: form.code.trim(), title: form.title.trim(), description: form.description.trim(), instructor: form.instructor.trim() };
      if (formCourse) await adminManagementService.updateCourse(formCourse.id, payload);
      else await adminManagementService.createCourse(payload);
      await load();
      setFormCourse(null);
      setIsFormOpen(false);
      setNotice(formCourse ? 'Course details saved.' : 'Course created.');
    } catch (cause) {
      setError(errorText(cause, 'Course could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  };

  const setActive = async (course: ManagedCourse) => {
    setError('');
    try {
      await adminManagementService.setCourseActive(course.id, !course.isActive);
      await load();
      setNotice(`Course ${course.isActive ? 'deactivated' : 'activated'}.`);
    } catch (cause) {
      setError(errorText(cause, 'Course status could not be changed.'));
    }
  };

  const assignStudent = async () => {
    if (!activeCourse || !selectedStudent) return;
    setIsSaving(true);
    setError('');
    try {
      await adminManagementService.assignStudent(activeCourse.id, selectedStudent);
      await showRoster(activeCourse);
      await load();
      setNotice('Student assigned to this course.');
    } catch (cause) {
      setError(errorText(cause, 'Student could not be assigned.'));
    } finally {
      setIsSaving(false);
    }
  };

  const removeStudent = async (studentId: number | string) => {
    if (!activeCourse) return;
    setError('');
    try {
      await adminManagementService.removeStudent(activeCourse.id, studentId);
      await showRoster(activeCourse);
      await load();
      setNotice('Student enrollment was removed. Historical records were preserved.');
    } catch (cause) {
      setError(errorText(cause, 'Student could not be removed.'));
    }
  };

  const enrolledIds = new Set(courseStudents.map((student) => String(student.id)));

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader title="Courses" subtitle="Create and maintain courses, review enrollment, and assign active students." action={<Button variant="primary" onClick={() => openForm()}><Plus className="h-4 w-4" /> New course</Button>} />
      {error ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm">{error}</p> : null}
      {notice ? <p role="status" className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm">{notice}</p> : null}

      <div className="mb-5 flex max-w-lg items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
        <Search className="h-4 w-4 text-[var(--color-primary)]" />
        <input aria-label="Search courses" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by code, title, instructor" className="w-full bg-transparent text-sm outline-none" />
      </div>

      {isLoading ? <p role="status" className="py-5 text-sm text-[var(--color-muted)]">Loading courses...</p> : null}
      {!isLoading && visible.length === 0 ? <Card className="p-6 text-sm text-[var(--color-muted)]">{search ? 'No courses match your search.' : 'No courses have been created yet.'}</Card> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((course) => <Card key={course.id} className="p-5">
          <div className="flex items-center justify-between">
            <span className="rounded-xl bg-[var(--color-background)] p-2 text-[var(--color-primary)]"><BookOpen className="h-4 w-4" /></span>
            <StatusBadge label={course.isActive ? 'Active' : 'Inactive'} tone={course.isActive ? 'success' : 'warning'} />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{course.code}</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">{course.title}</h2>
          {course.description ? <p className="mt-2 line-clamp-3 text-sm text-[var(--color-muted)]">{course.description}</p> : null}
          <p className="mt-3 text-sm text-[var(--color-muted)]">Instructor: {course.instructor || 'Not assigned'}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Active enrollments: {course.enrollmentCount}</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => void showRoster(course)}><Eye className="h-4 w-4" /> Students</Button>
            <Button variant="outline" size="sm" onClick={() => openForm(course)}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="ghost" size="sm" onClick={() => void setActive(course)}>{course.isActive ? 'Deactivate' : 'Activate'}</Button>
          </div>
        </Card>)}
      </div>

      <Modal isOpen={isFormOpen} title={formCourse ? 'Edit course' : 'Create course'} onClose={() => { setFormCourse(null); setForm(emptyForm); setIsFormOpen(false); }}>
        <form className="space-y-4" onSubmit={(event) => void saveCourse(event)}>
          <Input label="Course code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required maxLength={50} />
          <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={150} />
          <Input label="Instructor" value={form.instructor} onChange={(event) => setForm({ ...form, instructor: event.target.value })} maxLength={200} />
          <label className="block text-sm font-medium text-[var(--color-text)]">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={10000} rows={4} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm" /></label>
          <div className="flex justify-end gap-2"><Button variant="outline" type="button" onClick={() => { setFormCourse(null); setForm(emptyForm); setIsFormOpen(false); }}>Cancel</Button><Button variant="primary" type="submit" loading={isSaving}>Save course</Button></div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(activeCourse)} title={`${activeCourse?.title ?? ''} enrollments`} onClose={() => setActiveCourse(null)}>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select aria-label="Student to assign" value={selectedStudent} onChange={(event) => setSelectedStudent(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm">
              <option value="">Choose an active student</option>
              {students.filter((student) => student.status === 'Active' && !enrolledIds.has(String(student.id))).map((student) => <option key={student.id} value={student.id}>{student.fullName} · {student.studentId}</option>)}
            </select>
            <Button variant="primary" disabled={!selectedStudent} loading={isSaving} onClick={() => void assignStudent()}><UserPlus className="h-4 w-4" /> Assign</Button>
          </div>
          {isRosterLoading ? <p role="status" className="text-sm text-[var(--color-muted)]">Loading enrollments...</p> : null}
          {!isRosterLoading && courseStudents.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No students are enrolled in this course.</p> : null}
          <div className="max-h-80 space-y-2 overflow-y-auto">{courseStudents.map((student) => <div key={student.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] p-3">
            <span><span className="block font-medium">{student.fullName}</span><span className="text-xs text-[var(--color-muted)]">{student.studentId} · {student.enrollmentStatus}</span></span>
            <Button variant="ghost" size="sm" aria-label={`Remove ${student.fullName}`} onClick={() => void removeStudent(student.id)}><UserMinus className="h-4 w-4" /></Button>
          </div>)}</div>
        </div>
      </Modal>
    </div>
  );
}
