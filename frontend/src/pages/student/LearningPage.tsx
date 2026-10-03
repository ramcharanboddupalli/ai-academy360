import { useEffect, useState } from 'react';
import axios from 'axios';
import { BookOpenCheck, ClipboardList, LibraryBig } from 'lucide-react';
import { Card } from '../../components/Card';
import { LearningAdvisorPanel } from '../../components/LearningAdvisorPanel';
import { MetricCard } from '../../components/MetricCard';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { studentDashboardService, type StudentLearning } from '../../services/studentDashboard.service';

export function StudentLearningPage() {
  const [learning, setLearning] = useState<StudentLearning | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    studentDashboardService.getLearning()
      .then((response) => { if (isMounted) setLearning(response.data.learning); })
      .catch((cause: unknown) => { if (isMounted) setError(axios.isAxiosError(cause) && cause.response?.status === 401 ? 'Your session has expired. Sign in again.' : 'Learning data could not be loaded.'); })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader title="Learning" subtitle="Recorded progress, attendance, course resources, and tasks." />
      {isLoading ? <p role="status" className="mb-5 text-sm text-[var(--color-muted)]">Loading your learning activity...</p> : null}
      {error ? <p role="alert" className="mb-5 text-sm text-[var(--color-primary)]">{error}</p> : null}
      {learning ? <>
        {!learning.hasActivity ? <p className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-muted)]">No learning activity available yet.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Overall Progress" value={learning.overallProgress === null ? 'Not recorded' : `${learning.overallProgress}%`} note="From recorded course progress" icon={<BookOpenCheck className="h-4 w-4" />} />
          <MetricCard label="Attendance" value={learning.attendancePercent === null ? 'Not recorded' : `${learning.attendancePercent}%`} note="From attendance records" icon={<BookOpenCheck className="h-4 w-4" />} />
          <MetricCard label="Pending Tasks" value={String(learning.pendingTasks)} note="Not marked completed" icon={<ClipboardList className="h-4 w-4" />} />
          <MetricCard label="Completed Topics" value={String(learning.completedTopics.length)} note="Recorded completions" icon={<LibraryBig className="h-4 w-4" />} />
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <Card className="p-5"><h2 className="font-semibold text-[var(--color-text)]">Course Progress</h2>{learning.courses.length ? <div className="mt-4 space-y-3">{learning.courses.map((course) => <div key={course.id} className="rounded-xl border border-[var(--color-border)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-medium text-[var(--color-text)]">{course.name}</h3><span className="text-sm text-[var(--color-muted)]">{course.progress === null ? 'No progress recorded' : `${course.progress}%`}</span></div>{course.currentTopic ? <p className="mt-2 text-sm text-[var(--color-muted)]">Current topic: {course.currentTopic}</p> : null}</div>)}</div> : <p className="mt-3 text-sm text-[var(--color-muted)]">No enrolled courses available.</p>}</Card>

          <Card className="p-5"><h2 className="font-semibold text-[var(--color-text)]">Attendance</h2>{learning.attendance.length ? <div className="mt-4 space-y-3">{learning.attendance.map((item) => <div key={item.courseId} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3 last:border-0"><span className="font-medium text-[var(--color-text)]">{item.course}</span><span className="text-sm text-[var(--color-muted)]">{item.attendedClasses} attended of {item.recordedClasses} recorded · {item.attendancePercent}%</span></div>)}</div> : <p className="mt-3 text-sm text-[var(--color-muted)]">No attendance records available.</p>}</Card>

          <Card className="p-5"><h2 className="font-semibold text-[var(--color-text)]">Tasks</h2>{learning.tasks.length ? <div className="mt-4 divide-y divide-[var(--color-border)]">{learning.tasks.map((task) => <div key={task.id} className="py-3 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-medium text-[var(--color-text)]">{task.title}</h3><StatusBadge label={task.status.replaceAll('_', ' ')} tone={task.status === 'completed' ? 'success' : 'warning'} /></div><p className="mt-1 text-sm text-[var(--color-muted)]">{task.course}{task.dueAt ? ` · Due ${new Date(task.dueAt).toLocaleDateString()}` : ''}</p></div>)}</div> : <p className="mt-3 text-sm text-[var(--color-muted)]">No learning tasks available.</p>}</Card>

          <Card className="p-5"><h2 className="font-semibold text-[var(--color-text)]">Completed Topics</h2>{learning.completedTopics.length ? <ul className="mt-4 divide-y divide-[var(--color-border)]">{learning.completedTopics.map((topic) => <li key={`${topic.courseId}-${topic.id}`} className="py-3 first:pt-0"><p className="font-medium text-[var(--color-text)]">{topic.title}</p><p className="mt-1 text-sm text-[var(--color-muted)]">{topic.course} · Completed {new Date(topic.completedAt).toLocaleDateString()}</p></li>)}</ul> : <p className="mt-3 text-sm text-[var(--color-muted)]">No completed topics recorded.</p>}</Card>

          <Card className="p-5 xl:col-span-2"><h2 className="font-semibold text-[var(--color-text)]">Learning Resources</h2>{learning.resources.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{learning.resources.map((resource) => <div key={resource.id} className="rounded-xl border border-[var(--color-border)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-medium text-[var(--color-text)]">{resource.title}</h3><StatusBadge label={resource.resourceType} /></div><p className="mt-1 text-sm text-[var(--color-muted)]">{resource.course}</p>{resource.description ? <p className="mt-2 text-sm text-[var(--color-muted)]">{resource.description}</p> : null}{resource.resourceUrl ? <a href={resource.resourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)]">Open resource</a> : <p className="mt-3 text-sm text-[var(--color-muted)]">No resource link is available.</p>}</div>)}</div> : <p className="mt-3 text-sm text-[var(--color-muted)]">No learning resources available for your enrolled courses.</p>}</Card>
        </div>
        <div className="mt-6"><LearningAdvisorPanel hasActivity={learning.hasActivity} /></div>
      </> : null}
    </div>
  );
}