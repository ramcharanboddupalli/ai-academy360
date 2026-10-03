import axios from 'axios';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpenCheck, CalendarDays, Megaphone, Award, BriefcaseBusiness, Search } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { adminService, type AdminStudent } from '../../services/admin.service';
import {
  adminManagementService,
  type ManagedAnnouncement,
  type ManagedCertificate,
  type ManagedClass,
  type ManagedCourse,
  type ManagedInternshipApplication,
  type ManagedInternship,
  type ManagedProgress,
  type ManagedResource,
  type ManagedTask,
} from '../../services/adminManagement.service';

const tabs = ['learning', 'schedule', 'certificates', 'internships', 'announcements'] as const;
type Tab = (typeof tabs)[number];
const tabLabels: Record<Tab, string> = { learning: 'Learning', schedule: 'Schedule', certificates: 'Certificates', internships: 'Internships', announcements: 'Announcements' };
const inputClass = 'mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)]';

function apiError(error: unknown, fallback: string) {
  return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data.message ?? fallback : fallback;
}

function toDatetime(value: string | null | undefined) {
  return value ? value.slice(0, 16) : '';
}

function parseList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).join(', ');
      if (typeof parsed === 'string') return parsed;
    } catch {
      return value;
    }
    return value;
  }
  return '';
}

export function AdminAcademyManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: Tab = tabs.includes(requestedTab as Tab) ? requestedTab as Tab : 'learning';
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [tasks, setTasks] = useState<ManagedTask[]>([]);
  const [progress, setProgress] = useState<ManagedProgress[]>([]);
  const [classes, setClasses] = useState<ManagedClass[]>([]);
  const [certificates, setCertificates] = useState<ManagedCertificate[]>([]);
  const [internships, setInternships] = useState<ManagedInternship[]>([]);
  const [internshipApplications, setInternshipApplications] = useState<ManagedInternshipApplication[]>([]);
  const [announcements, setAnnouncements] = useState<ManagedAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    const [courseResponse, studentResponse, learningResponse, classResponse, certificateResponse, internshipResponse, applicationResponse, announcementResponse] = await Promise.all([
      adminManagementService.courses(), adminService.getStudents(), adminManagementService.learning(),
      adminManagementService.classes(), adminManagementService.certificates(),
      adminManagementService.internships(), adminManagementService.internshipApplications(), adminManagementService.announcements(),
    ]);
    setCourses(courseResponse.data.courses);
    setStudents(studentResponse.data.students);
    setResources(learningResponse.data.resources);
    setTasks(learningResponse.data.tasks);
    setProgress(learningResponse.data.progress);
    setClasses(classResponse.data.classes);
    setCertificates(certificateResponse.data.certificates);
    setInternships(internshipResponse.data.internships);
    setInternshipApplications(applicationResponse.data.applications);
    setAnnouncements(announcementResponse.data.announcements);
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([
      adminManagementService.courses(), adminService.getStudents(), adminManagementService.learning(),
      adminManagementService.classes(), adminManagementService.certificates(),
      adminManagementService.internships(), adminManagementService.internshipApplications(), adminManagementService.announcements(),
    ])
      .then(([courseResponse, studentResponse, learningResponse, classResponse, certificateResponse, internshipResponse, applicationResponse, announcementResponse]) => {
        if (!mounted) return;
        setCourses(courseResponse.data.courses);
        setStudents(studentResponse.data.students);
        setResources(learningResponse.data.resources);
        setTasks(learningResponse.data.tasks);
        setProgress(learningResponse.data.progress);
        setClasses(classResponse.data.classes);
        setCertificates(certificateResponse.data.certificates);
        setInternships(internshipResponse.data.internships);
        setInternshipApplications(applicationResponse.data.applications);
        setAnnouncements(announcementResponse.data.announcements);
      })
      .catch((cause: unknown) => { if (mounted) setError(apiError(cause, 'Academy management records could not be loaded.')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  const visible = <T,>(items: T[], fields: Array<keyof T>) => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => !query || fields.some((field) => String(item[field] ?? '').toLowerCase().includes(query)));
  };

  const runSave = async (action: () => Promise<unknown>, message: string) => {
    setError('');
    setNotice('');
    setIsSaving(true);
    try {
      await action();
      await load();
      setNotice(message);
      return true;
    } catch (cause) {
      setError(apiError(cause, 'The change could not be saved.'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const errorNotice = <>{error ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm">{error}</p> : null}{notice ? <p role="status" className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm">{notice}</p> : null}</>;

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader title="Academy Management" subtitle="Manage learning, classes, credentials, opportunities, and student communications." />
      {errorNotice}
      {isLoading ? <p role="status" className="mb-4 text-sm text-[var(--color-muted)]">Loading academy management data from MySQL...</p> : null}
      {isSaving ? <p role="status" className="mb-4 text-sm text-[var(--color-muted)]">Saving and refreshing records...</p> : null}
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Academy management sections">
        {tabs.map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => { setSearchParams({ tab }); setSearch(''); }} className={`rounded-xl border px-4 py-2 text-sm font-medium ${activeTab === tab ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white' : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text)]'}`}>{tabLabels[tab]}</button>)}
      </div>
      <div className="mb-5 flex max-w-lg items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
        <Search className="h-4 w-4 text-[var(--color-primary)]" /><input aria-label={`Search ${tabLabels[activeTab]}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${tabLabels[activeTab].toLowerCase()}`} className="w-full bg-transparent text-sm outline-none" />
      </div>

      {activeTab === 'learning' ? <LearningPanel courses={courses} students={students} resources={visible(resources, ['title', 'course', 'resourceType'])} tasks={visible(tasks, ['title', 'course', 'studentName', 'status'])} progress={visible(progress, ['studentName', 'studentCode', 'course', 'currentTopic'])} runSave={runSave} /> : null}
      {activeTab === 'schedule' ? <SchedulePanel courses={courses} classes={visible(classes, ['title', 'course', 'instructor', 'location', 'status'])} runSave={runSave} /> : null}
      {activeTab === 'certificates' ? <CertificatesPanel courses={courses} students={students} certificates={visible(certificates, ['studentName', 'studentCode', 'title', 'course', 'certificateId', 'status'])} runSave={runSave} /> : null}
      {activeTab === 'internships' ? <InternshipsPanel internships={visible(internships, ['title', 'organization', 'location', 'workMode'])} applications={visible(internshipApplications, ['studentName', 'studentCode', 'studentEmail', 'internshipTitle', 'organization', 'status'])} runSave={runSave} /> : null}
      {activeTab === 'announcements' ? <AnnouncementsPanel announcements={visible(announcements, ['title', 'category', 'targetType', 'targetCourse', 'targetStudent'])} courses={courses} students={students} runSave={runSave} /> : null}
    </div>
  );
}

type SaveRunner = (action: () => Promise<unknown>, message: string) => Promise<boolean>;

function LearningPanel({ courses, students, resources, tasks, progress, runSave }: {
  courses: ManagedCourse[]; students: AdminStudent[]; resources: ManagedResource[]; tasks: ManagedTask[]; progress: ManagedProgress[]; runSave: SaveRunner;
}) {
  const [resource, setResource] = useState({ courseId: '', title: '', description: '', resourceType: 'note' as ManagedResource['resourceType'], resourceUrl: '' });
  const [task, setTask] = useState({ courseId: '', studentId: '', title: '', description: '', dueAt: '' });
  const [progressForm, setProgressForm] = useState({ studentId: '', courseId: '', progress: '', currentTopic: '' });
  const [editingTask, setEditingTask] = useState<ManagedTask | null>(null);
  const [taskEdit, setTaskEdit] = useState({ title: '', description: '', dueAt: '', status: 'pending' as ManagedTask['status'] });

  const submitResource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSave(() => adminManagementService.createResource({ ...resource, courseId: resource.courseId }), 'Learning resource saved and made available to enrolled students.').then((saved) => { if (saved) setResource({ courseId: '', title: '', description: '', resourceType: 'note', resourceUrl: '' }); });
  };
  const submitTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSave(() => adminManagementService.createTask({ ...task, courseId: task.courseId, studentId: task.studentId || undefined, dueAt: task.dueAt || null }), 'Task assigned to enrolled students.').then((saved) => { if (saved) setTask({ courseId: '', studentId: '', title: '', description: '', dueAt: '' }); });
  };
  const submitProgress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSave(() => adminManagementService.updateProgress({ ...progressForm, studentId: progressForm.studentId, courseId: progressForm.courseId, progress: Number(progressForm.progress) }), 'Student progress recorded.').then((saved) => { if (saved) setProgressForm({ studentId: '', courseId: '', progress: '', currentTopic: '' }); });
  };

  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="p-5"><div className="mb-4 flex items-center gap-2"><BookOpenCheck className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-semibold">Create learning resource</h2></div>
        <form className="space-y-3" onSubmit={submitResource}>
          <label className="block text-sm">Course<select className={inputClass} required value={resource.courseId} onChange={(event) => setResource({ ...resource, courseId: event.target.value })}><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
          <Input label="Title" value={resource.title} onChange={(event) => setResource({ ...resource, title: event.target.value })} required maxLength={255} />
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Type<select className={inputClass} value={resource.resourceType} onChange={(event) => setResource({ ...resource, resourceType: event.target.value as ManagedResource['resourceType'] })}><option value="note">Note</option><option value="pdf">PDF</option><option value="video">Video</option><option value="link">Link</option><option value="assignment">Assignment</option></select></label><Input label="Resource URL" type="url" value={resource.resourceUrl} onChange={(event) => setResource({ ...resource, resourceUrl: event.target.value })} maxLength={2048} /></div>
          <label className="block text-sm">Description<textarea className={inputClass} rows={2} value={resource.description} onChange={(event) => setResource({ ...resource, description: event.target.value })} maxLength={10000} /></label>
          <Button variant="primary" type="submit">Save resource</Button>
        </form>
      </Card>
      <Card className="p-5"><h2 className="mb-4 font-semibold">Create task / assignment</h2>
        <form className="space-y-3" onSubmit={submitTask}>
          <label className="block text-sm">Course<select className={inputClass} required value={task.courseId} onChange={(event) => setTask({ ...task, courseId: event.target.value, studentId: '' })}><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
          <label className="block text-sm">Assign to<select className={inputClass} value={task.studentId} onChange={(event) => setTask({ ...task, studentId: event.target.value })}><option value="">All active students enrolled in course</option>{students.filter((student) => student.status === 'Active' && student.courses.some((course) => String(course.id) === task.courseId)).map((student) => <option key={student.id} value={student.id}>{student.fullName} · {student.studentId}</option>)}</select></label>
          <Input label="Task title" value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} required maxLength={255} />
          <div className="grid gap-3 sm:grid-cols-2"><Input label="Deadline" type="datetime-local" value={task.dueAt} onChange={(event) => setTask({ ...task, dueAt: event.target.value })} /><Input label="Description" value={task.description} onChange={(event) => setTask({ ...task, description: event.target.value })} maxLength={10000} /></div>
          <Button variant="primary" type="submit">Create task</Button>
        </form>
      </Card>
      <Card className="p-5 xl:col-span-2"><h2 className="mb-4 font-semibold">Record student progress</h2><form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" onSubmit={submitProgress}>
        <label className="block text-sm">Student<select required className={inputClass} value={progressForm.studentId} onChange={(event) => setProgressForm({ ...progressForm, studentId: event.target.value })}><option value="">Select student</option>{students.filter((student) => student.status === 'Active').map((student) => <option key={student.id} value={student.id}>{student.fullName}</option>)}</select></label>
        <label className="block text-sm">Course<select required className={inputClass} value={progressForm.courseId} onChange={(event) => setProgressForm({ ...progressForm, courseId: event.target.value })}><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <Input label="Progress (%)" type="number" min="0" max="100" step="0.01" value={progressForm.progress} onChange={(event) => setProgressForm({ ...progressForm, progress: event.target.value })} required />
        <Input label="Current topic" value={progressForm.currentTopic} onChange={(event) => setProgressForm({ ...progressForm, currentTopic: event.target.value })} maxLength={255} />
        <div className="flex items-end"><Button variant="primary" type="submit">Save progress</Button></div>
      </form></Card>
    </div>
    <Card className="p-5"><h2 className="mb-3 font-semibold">Resources</h2>{resources.length ? <div className="divide-y divide-[var(--color-border)]">{resources.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><strong>{item.title}</strong><span className="ml-2 text-sm text-[var(--color-muted)]">{item.course} · {item.resourceType}</span></span><Button variant="outline" size="sm" onClick={() => void runSave(() => adminManagementService.updateResource(item.id, { courseId: item.courseId, title: item.title, description: item.description ?? '', resourceType: item.resourceType, resourceUrl: item.resourceUrl ?? '', isActive: !item.isActive }), `Resource ${item.isActive ? 'hidden' : 'published'} for students.`)}>{item.isActive ? 'Hide' : 'Publish'}</Button></div>)}</div> : <p className="text-sm text-[var(--color-muted)]">No learning resources recorded.</p>}</Card>
    <Card className="p-5"><h2 className="mb-3 font-semibold">Tasks and assignment status</h2>{tasks.length ? <div className="space-y-2">{tasks.map((item) => <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] p-3 sm:flex-row sm:items-center sm:justify-between"><span><strong>{item.title}</strong><span className="block text-sm text-[var(--color-muted)]">{item.course} · {item.studentName}{item.dueAt ? ` · due ${new Date(item.dueAt).toLocaleString()}` : ''}</span></span><div className="flex gap-2"><select aria-label={`Status for ${item.title}`} className={inputClass} value={item.status} onChange={(event) => { const status = event.target.value as ManagedTask['status']; void runSave(() => adminManagementService.updateTask(item.id, { title: item.title, description: item.description ?? '', dueAt: item.dueAt, status }), 'Task status updated.'); }}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select><Button variant="outline" size="sm" onClick={() => { setEditingTask(item); setTaskEdit({ title: item.title, description: item.description ?? '', dueAt: toDatetime(item.dueAt), status: item.status }); }}>Edit</Button></div></div>)}</div> : <p className="text-sm text-[var(--color-muted)]">No tasks recorded.</p>}</Card>
    {editingTask ? <Card className="p-5"><h2 className="mb-3 font-semibold">Edit task · {editingTask.studentName}</h2><form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void runSave(() => adminManagementService.updateTask(editingTask.id, { ...taskEdit, dueAt: taskEdit.dueAt || null }), 'Task details updated.').then((saved) => { if (saved) setEditingTask(null); }); }}><Input label="Title" value={taskEdit.title} onChange={(event) => setTaskEdit({ ...taskEdit, title: event.target.value })} required /><Input label="Deadline" type="datetime-local" value={taskEdit.dueAt} onChange={(event) => setTaskEdit({ ...taskEdit, dueAt: event.target.value })} /><Input label="Description" value={taskEdit.description} onChange={(event) => setTaskEdit({ ...taskEdit, description: event.target.value })} /><label className="block text-sm">Status<select className={inputClass} value={taskEdit.status} onChange={(event) => setTaskEdit({ ...taskEdit, status: event.target.value as ManagedTask['status'] })}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label><Button variant="primary" type="submit">Save task</Button><Button variant="outline" type="button" onClick={() => setEditingTask(null)}>Cancel</Button></form></Card> : null}
    <Card className="p-5"><h2 className="mb-3 font-semibold">Recorded course progress</h2>{progress.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]"><th className="py-2 pr-4">Student</th><th className="py-2 pr-4">Course</th><th className="py-2 pr-4">Progress</th><th className="py-2">Current topic</th></tr></thead><tbody>{progress.map((item) => <tr key={`${item.studentId}-${item.courseId}`} className="border-b border-[var(--color-border)] last:border-0"><td className="py-2 pr-4">{item.studentName}</td><td className="py-2 pr-4">{item.course}</td><td className="py-2 pr-4">{item.progress ?? 'Not recorded'}{item.progress === null ? '' : '%'}</td><td className="py-2">{item.currentTopic ?? '—'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[var(--color-muted)]">No progress records yet.</p>}</Card>
  </div>;
}

function SchedulePanel({ courses, classes, runSave }: { courses: ManagedCourse[]; classes: ManagedClass[]; runSave: SaveRunner }) {
  const empty = { courseId: '', title: '', startsAt: '', endsAt: '', instructor: '', location: '', meetingUrl: '', recordingUrl: '', status: 'scheduled' as ManagedClass['status'] };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<ManagedClass | null>(null);
  const [attendanceClassId, setAttendanceClassId] = useState('');
  const [roster, setRoster] = useState<Array<{ studentId: number | string; studentCode: string; fullName: string; attendanceStatus: string | null }>>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, 'present' | 'absent' | 'late' | 'excused'>>({});
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterError, setRosterError] = useState('');

  const edit = (item: ManagedClass) => {
    setEditing(item);
    setForm({ courseId: String(item.courseId), title: item.title, startsAt: toDatetime(item.startsAt), endsAt: toDatetime(item.endsAt), instructor: item.instructor ?? '', location: item.location ?? '', meetingUrl: item.meetingUrl ?? '', recordingUrl: item.recordingUrl ?? '', status: item.status });
  };
  const loadRoster = async (classId: string) => {
    setAttendanceClassId(classId);
    setRoster([]);
    setRosterError('');
    if (!classId) return;
    setLoadingRoster(true);
    try {
      const response = await adminManagementService.attendanceRoster(classId);
      setRoster(response.data.students);
      setAttendanceStatus(Object.fromEntries(response.data.students.map((student) => [String(student.studentId), (student.attendanceStatus ?? 'present') as 'present' | 'absent' | 'late' | 'excused'])));
    } catch (cause) {
      setRoster([]);
      setRosterError(apiError(cause, 'Attendance roster could not be loaded.'));
    } finally {
      setLoadingRoster(false);
    }
  };

  return <div className="space-y-5">
    <Card className="p-5"><div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-semibold">{editing ? 'Edit / reschedule class' : 'Add scheduled class'}</h2></div>
      <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => { event.preventDefault(); const payload = { ...form, startsAt: form.startsAt, endsAt: form.endsAt, status: form.status }; void runSave(() => editing ? adminManagementService.updateClass(editing.id, payload) : adminManagementService.createClass(payload), editing ? 'Class updated.' : 'Class scheduled. It will appear for active students enrolled in the selected course.').then((saved) => { if (saved) { setForm(empty); setEditing(null); } }); }}>
        <label className="block text-sm xl:col-span-2">Course<select className={inputClass} required value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <Input label="Class title / topic" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={200} />
        <Input label="Instructor" value={form.instructor} onChange={(event) => setForm({ ...form, instructor: event.target.value })} maxLength={200} />
        <Input label="Start" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required />
        <Input label="End" type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} required />
        <Input label="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} maxLength={200} />
        <Input label="Meeting link" type="url" value={form.meetingUrl} onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })} maxLength={2048} />
        <Input label="Recording link" type="url" value={form.recordingUrl} onChange={(event) => setForm({ ...form, recordingUrl: event.target.value })} maxLength={2048} />
        <label className="block text-sm">Status<select className={inputClass} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ManagedClass['status'] })}><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        <div className="flex items-end gap-2"><Button variant="primary" type="submit">{editing ? 'Save class' : 'Create class'}</Button>{editing ? <Button variant="outline" type="button" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</Button> : null}</div>
      </form>
    </Card>
    <Card className="p-5"><h2 className="mb-3 font-semibold">Schedule records</h2>{classes.length ? <div className="space-y-2">{classes.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] p-3 md:flex-row md:items-center md:justify-between"><span><strong>{item.title}</strong><span className="block text-sm text-[var(--color-muted)]">{item.course} · {new Date(item.startsAt).toLocaleString()} · {item.instructor || 'No instructor'}</span></span><div className="flex gap-2"><StatusBadge label={item.status} /><Button variant="outline" size="sm" onClick={() => edit(item)}>Edit</Button></div></div>)}</div> : <p className="text-sm text-[var(--color-muted)]">No classes match this search.</p>}</Card>
    <Card className="p-5"><h2 className="mb-3 font-semibold">Record attendance</h2><label className="block max-w-xl text-sm">Class<select value={attendanceClassId} onChange={(event) => void loadRoster(event.target.value)} className={inputClass}><option value="">Choose a class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.course} · {item.title} · {new Date(item.startsAt).toLocaleString()}</option>)}</select></label>
      {loadingRoster ? <p role="status" className="mt-3 text-sm">Loading enrolled students...</p> : null}
      {rosterError ? <p role="alert" className="mt-3 text-sm text-[var(--color-primary)]">{rosterError}</p> : null}
      {roster.map((student) => <div key={student.studentId} className="mt-2 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] py-2"><span>{student.fullName} · {student.studentCode}</span><select aria-label={`Attendance for ${student.fullName}`} value={attendanceStatus[String(student.studentId)] ?? 'present'} onChange={(event) => setAttendanceStatus({ ...attendanceStatus, [String(student.studentId)]: event.target.value as 'present' | 'absent' | 'late' | 'excused' })} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1"><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option></select></div>)}
      {!loadingRoster && attendanceClassId && roster.length === 0 ? <p className="mt-3 text-sm text-[var(--color-muted)]">No active students are enrolled in this class's course.</p> : null}
      {roster.length ? <Button className="mt-4" variant="primary" onClick={() => void runSave(() => adminManagementService.saveAttendance(attendanceClassId, roster.map((student) => ({ studentId: student.studentId, status: attendanceStatus[String(student.studentId)] ?? 'present' }))), 'Attendance saved for the selected class.')}>Save attendance</Button> : null}
    </Card>
  </div>;
}

function CertificatesPanel({ courses, students, certificates, runSave }: { courses: ManagedCourse[]; students: AdminStudent[]; certificates: ManagedCertificate[]; runSave: SaveRunner }) {
  const [form, setForm] = useState({ studentId: '', courseId: '', title: '', certificateId: '', issueDate: new Date().toISOString().slice(0, 10), fileUrl: '' });
  return <div className="space-y-5">
    <Card className="p-5"><div className="mb-4 flex items-center gap-2"><Award className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-semibold">Issue certificate</h2></div><form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" onSubmit={(event) => { event.preventDefault(); void runSave(() => adminManagementService.issueCertificate(form), 'Certificate issued and available in the student portal.').then((saved) => { if (saved) setForm({ studentId: '', courseId: '', title: '', certificateId: '', issueDate: new Date().toISOString().slice(0, 10), fileUrl: '' }); }); }}>
      <label className="block text-sm">Student<select required className={inputClass} value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.fullName} · {student.studentId}</option>)}</select></label>
      <label className="block text-sm">Course<select required className={inputClass} value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
      <Input label="Certificate title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={255} />
      <Input label="Certificate number" value={form.certificateId} onChange={(event) => setForm({ ...form, certificateId: event.target.value })} required maxLength={120} />
      <Input label="Issue date" type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} required />
      <Input label="Certificate URL" type="url" value={form.fileUrl} onChange={(event) => setForm({ ...form, fileUrl: event.target.value })} maxLength={2048} />
      <Button variant="primary" type="submit">Issue certificate</Button>
    </form></Card>
    <Card className="p-5"><h2 className="mb-3 font-semibold">Certificates</h2>{certificates.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]"><th className="py-2 pr-4">Student</th><th className="py-2 pr-4">Certificate</th><th className="py-2 pr-4">Course</th><th className="py-2 pr-4">Number</th><th className="py-2 pr-4">Issue date</th><th className="py-2 pr-4">Verification</th><th className="py-2">Update</th></tr></thead><tbody>{certificates.map((item) => <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0"><td className="py-2 pr-4">{item.studentName}</td><td className="py-2 pr-4">{item.title}</td><td className="py-2 pr-4">{item.course}</td><td className="py-2 pr-4">{item.certificateId}</td><td className="py-2 pr-4">{item.issueDate ?? '—'}</td><td className="py-2 pr-4"><StatusBadge label={item.status === 'issued' ? 'Verified' : item.status} tone={item.status === 'issued' ? 'success' : item.status === 'pending' ? 'warning' : 'info'} /></td><td className="py-2"><select aria-label={`Certificate status ${item.certificateId}`} value={item.status} onChange={(event) => void runSave(() => adminManagementService.setCertificateStatus(item.id, event.target.value as ManagedCertificate['status']), 'Certificate verification status updated.')} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1"><option value="pending">Pending verification</option><option value="issued">Verified</option><option value="revoked">Revoked</option></select></td></tr>)}</tbody></table></div> : <p className="text-sm text-[var(--color-muted)]">No certificates have been recorded.</p>}</Card>
  </div>;
}

function InternshipsPanel({ internships, applications, runSave }: { internships: ManagedInternship[]; applications: ManagedInternshipApplication[]; runSave: SaveRunner }) {
  const empty = { title: '', organization: '', description: '', duration: '', location: '', workMode: '', requirements: '', skillRequirements: '', eligibility: '', stipendAmount: '', applicationDeadline: '', applicationUrl: '', isPublished: false };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<ManagedInternship | null>(null);
  const [applicationStatusFilter, setApplicationStatusFilter] = useState('all');
  const [applicationDrafts, setApplicationDrafts] = useState<Record<string, { status: ManagedInternshipApplication['status']; adminNote: string }>>({});
  const edit = (item: ManagedInternship) => {
    setEditing(item);
    setForm({ title: item.title, organization: item.organization, description: item.description ?? '', duration: item.duration ?? '', location: item.location ?? '', workMode: item.workMode ?? '', requirements: parseList(item.requirements), skillRequirements: parseList(item.skillRequirements), eligibility: item.eligibility ?? '', stipendAmount: item.stipendAmount == null ? '' : String(item.stipendAmount), applicationDeadline: toDatetime(item.applicationDeadline), applicationUrl: item.applicationUrl ?? '', isPublished: item.isPublished });
  };
  const visibleApplications = applications.filter((item) => applicationStatusFilter === 'all' || item.status === applicationStatusFilter);
  return <div className="space-y-5">
    <Card className="p-5"><div className="mb-4 flex items-center gap-2"><BriefcaseBusiness className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-semibold">{editing ? 'Edit internship opportunity' : 'Create internship opportunity'}</h2></div>
      <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => { event.preventDefault(); const payload = { ...form, stipendAmount: form.stipendAmount ? Number(form.stipendAmount) : null, requirements: form.requirements.split(',').map((item) => item.trim()).filter(Boolean), skillRequirements: form.skillRequirements.split(',').map((item) => item.trim()).filter(Boolean), applicationDeadline: form.applicationDeadline || null }; void runSave(() => editing ? adminManagementService.updateInternship(editing.id, payload) : adminManagementService.createInternship(payload), editing ? 'Internship opportunity updated.' : 'Internship opportunity created.').then((saved) => { if (saved) { setEditing(null); setForm(empty); } }); }}>
        <Input label="Role / title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={255} />
        <Input label="Organization" value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} required maxLength={255} />
        <Input label="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} maxLength={255} />
        <label className="block text-sm">Work mode<select className={inputClass} value={form.workMode} onChange={(event) => setForm({ ...form, workMode: event.target.value })}><option value="">Not specified</option><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label>
        <Input label="Duration" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} maxLength={100} />
        <Input label="Stipend (₹ INR)" type="number" min="0" step="0.01" value={form.stipendAmount} onChange={(event) => setForm({ ...form, stipendAmount: event.target.value })} />
        <Input label="Application deadline" type="datetime-local" value={form.applicationDeadline} onChange={(event) => setForm({ ...form, applicationDeadline: event.target.value })} />
        <Input label="Application link" type="url" value={form.applicationUrl} onChange={(event) => setForm({ ...form, applicationUrl: event.target.value })} maxLength={2048} />
        <Input label="Skills (comma-separated)" value={form.skillRequirements} onChange={(event) => setForm({ ...form, skillRequirements: event.target.value })} />
        <Input label="Requirements (comma-separated)" value={form.requirements} onChange={(event) => setForm({ ...form, requirements: event.target.value })} />
        <Input label="Eligibility" value={form.eligibility} onChange={(event) => setForm({ ...form, eligibility: event.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} /> Published to students</label>
        <label className="block text-sm sm:col-span-2 xl:col-span-4">Description<textarea className={inputClass} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={10000} /></label>
        <div className="flex gap-2"><Button variant="primary" type="submit">{editing ? 'Save opportunity' : 'Create opportunity'}</Button>{editing ? <Button variant="outline" type="button" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</Button> : null}</div>
      </form>
    </Card>
    <Card className="p-5"><h2 className="mb-3 font-semibold">Internships</h2>{internships.length ? <div className="space-y-2">{internships.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] py-3"><span><strong>{item.title}</strong><span className="block text-sm text-[var(--color-muted)]">{item.organization} · {item.location ?? 'Location not specified'} · {item.stipendAmount == null ? 'Stipend not listed' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.stipendAmount)}</span></span><div className="flex items-center gap-2"><StatusBadge label={item.isPublished ? 'Published' : 'Draft'} /><Button variant="outline" size="sm" onClick={() => edit(item)}>Edit / publish</Button></div></div>)}</div> : <p className="text-sm text-[var(--color-muted)]">No internship opportunities recorded.</p>}</Card>
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Student applications</h2><select aria-label="Filter applications by status" value={applicationStatusFilter} onChange={(event) => setApplicationStatusFilter(event.target.value)} className={inputClass + ' w-auto'}><option value="all">All statuses</option>{['applied', 'under_review', 'shortlisted', 'in_progress', 'completed', 'rejected', 'selected', 'withdrawn'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></div>
      {visibleApplications.length ? <div className="space-y-3">{visibleApplications.map((application) => {
        const draft = applicationDrafts[String(application.id)] ?? { status: application.status, adminNote: application.adminNote ?? '' };
        return <div key={application.id} className="rounded-xl border border-[var(--color-border)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{application.studentName} · {application.studentCode}</h3><p className="text-sm text-[var(--color-muted)]">{application.studentEmail}</p><p className="mt-2 text-sm font-medium">{application.internshipTitle} · {application.organization}</p><p className="text-xs text-[var(--color-muted)]">Applied {new Date(application.appliedAt).toLocaleString()} · {application.location ?? 'Location not specified'} · {application.workMode ?? 'Work mode not specified'}</p></div><StatusBadge label={application.status.replaceAll('_', ' ')} /></div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end"><label className="block text-sm">Application status<select aria-label={`Status for ${application.studentName} application ${application.id}`} value={draft.status} onChange={(event) => setApplicationDrafts({ ...applicationDrafts, [String(application.id)]: { ...draft, status: event.target.value as ManagedInternshipApplication['status'] } })} className={inputClass}>{['applied', 'under_review', 'shortlisted', 'in_progress', 'completed', 'rejected', 'selected', 'withdrawn'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><label className="block text-sm">Admin update<textarea maxLength={2000} rows={2} value={draft.adminNote} onChange={(event) => setApplicationDrafts({ ...applicationDrafts, [String(application.id)]: { ...draft, adminNote: event.target.value } })} className={inputClass} /></label><Button variant="primary" size="sm" onClick={() => void runSave(() => adminManagementService.updateInternshipApplication(application.id, draft), 'Application updated; the student was notified.')}>Save update</Button></div>
        </div>;
      })}</div> : <p className="text-sm text-[var(--color-muted)]">{applications.length ? 'No applications match this status or search.' : 'No student applications have been submitted.'}</p>}
    </Card>
  </div>;
}

function AnnouncementsPanel({ announcements, courses, students, runSave }: { announcements: ManagedAnnouncement[]; courses: ManagedCourse[]; students: AdminStudent[]; runSave: SaveRunner }) {
  const empty = { title: '', message: '', category: 'general' as ManagedAnnouncement['category'], targetType: 'all' as ManagedAnnouncement['targetType'], targetCourseId: '', targetStudentId: '', isPublished: false, scheduledAt: '', expiresAt: '' };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<ManagedAnnouncement | null>(null);
  const edit = (item: ManagedAnnouncement) => {
    setEditing(item);
    setForm({ title: item.title, message: item.message, category: item.category, targetType: item.targetType, targetCourseId: item.targetCourseId == null ? '' : String(item.targetCourseId), targetStudentId: item.targetStudentId == null ? '' : String(item.targetStudentId), isPublished: item.isPublished, scheduledAt: toDatetime(item.scheduledAt), expiresAt: toDatetime(item.expiresAt) });
  };
  const payload = () => ({ ...form, targetCourseId: form.targetType === 'course' ? form.targetCourseId : null, targetStudentId: form.targetType === 'student' ? form.targetStudentId : null, scheduledAt: form.scheduledAt || null, expiresAt: form.expiresAt || null });
  return <div className="space-y-5">
    <Card className="p-5"><div className="mb-4 flex items-center gap-2"><Megaphone className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-semibold">{editing ? 'Edit announcement' : 'Create announcement'}</h2></div>
      <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => { event.preventDefault(); const value = payload(); void runSave(() => editing ? adminManagementService.updateAnnouncement(editing.id, value) : adminManagementService.createAnnouncement(value), editing ? 'Announcement updated.' : 'Announcement saved. Scheduled and published announcements appear to their intended students.').then((saved) => { if (saved) { setEditing(null); setForm(empty); } }); }}>
        <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={255} />
        <label className="block text-sm">Category<select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ManagedAnnouncement['category'] })}>{['general', 'course', 'schedule', 'payment', 'internship', 'important'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="block text-sm">Target<select className={inputClass} value={form.targetType} onChange={(event) => setForm({ ...form, targetType: event.target.value as ManagedAnnouncement['targetType'], targetCourseId: '', targetStudentId: '' })}><option value="all">All students</option><option value="course">Selected course</option><option value="student">Selected student</option></select></label>
        {form.targetType === 'course' ? <label className="block text-sm">Course<select required className={inputClass} value={form.targetCourseId} onChange={(event) => setForm({ ...form, targetCourseId: event.target.value })}><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label> : null}
        {form.targetType === 'student' ? <label className="block text-sm">Student<select required className={inputClass} value={form.targetStudentId} onChange={(event) => setForm({ ...form, targetStudentId: event.target.value })}><option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.fullName} · {student.studentId}</option>)}</select></label> : null}
        <Input label="Schedule publish time" type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} />
        <Input label="Expiration time" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} /> Publish (or schedule)</label>
        <label className="block text-sm sm:col-span-2 xl:col-span-4">Message<textarea required className={inputClass} rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} maxLength={20000} /></label>
        <div className="flex gap-2"><Button variant="primary" type="submit">{editing ? 'Save announcement' : 'Create announcement'}</Button>{editing ? <Button variant="outline" type="button" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</Button> : null}</div>
      </form>
    </Card>
    <Card className="p-5"><h2 className="mb-3 font-semibold">Announcements</h2>{announcements.length ? <div className="space-y-3">{announcements.map((item) => <div key={item.id} className="rounded-xl border border-[var(--color-border)] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{item.title}</span><div className="flex items-center gap-2"><StatusBadge label={item.isPublished ? 'Published' : 'Draft'} /><Button variant="outline" size="sm" onClick={() => edit(item)}>Edit</Button><Button variant="ghost" size="sm" disabled={item.isPublished || item.readCount > 0} title="Only drafts without student reads can be deleted" onClick={() => void runSave(() => adminManagementService.deleteAnnouncement(item.id), 'Draft announcement deleted.')}>Delete</Button></div></div><p className="mt-1 text-sm text-[var(--color-muted)]">{item.category} · {item.targetType === 'all' ? 'All students' : item.targetCourse ?? item.targetStudent ?? 'Target missing'} · {item.readCount} reads</p>{item.scheduledAt ? <p className="mt-1 text-xs text-[var(--color-muted)]">Scheduled: {new Date(item.scheduledAt).toLocaleString()}</p> : null}{item.expiresAt ? <p className="text-xs text-[var(--color-muted)]">Expires: {new Date(item.expiresAt).toLocaleString()}</p> : null}</div>)}</div> : <p className="text-sm text-[var(--color-muted)]">No announcements recorded.</p>}</Card>
  </div>;
}
