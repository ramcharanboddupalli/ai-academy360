import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowRight, BookOpenCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { SearchInput } from '../../components/SearchInput';
import { StatusBadge } from '../../components/StatusBadge';
import { studentService, type StudentCourse } from '../../services/student.service';

export function StudentCoursesPage() {
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    studentService.getCourses()
      .then((response) => { if (isMounted) setCourses(response.data.courses); })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setErrorMessage(axios.isAxiosError(error) && error.response?.status === 401
          ? 'Your session has expired. Sign in again to view your courses.'
          : 'Your assigned courses could not be loaded. Check your connection and try again.');
      })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const visibleCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) => !query || `${course.name} ${course.code}`.toLowerCase().includes(query));
  }, [courses, search]);

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="My Courses" subtitle="Courses assigned to your account by academy management." />
      <div className="mb-5 max-w-md">
        <SearchInput value={search} onChange={setSearch} placeholder="Search my courses" />
      </div>

      {isLoading ? <p role="status" className="mb-5 text-sm text-[var(--color-muted)]">Loading your assigned courses...</p> : null}
      {errorMessage ? <p role="alert" className="mb-5 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm text-[var(--color-text)]">{errorMessage}</p> : null}
      {!isLoading && !errorMessage && courses.length === 0 ? <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-sm text-[var(--color-muted)]">No courses have been assigned to your account yet.</p> : null}
      {!isLoading && !errorMessage && courses.length > 0 && visibleCourses.length === 0 ? <p className="mb-5 text-sm text-[var(--color-muted)]">No assigned courses match your search.</p> : null}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleCourses.map((course) => (
          <Card key={course.id} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="rounded-xl bg-[var(--color-background)] p-2 text-[var(--color-primary)]">
                <BookOpenCheck className="h-4 w-4" />
              </div>
              <StatusBadge label={course.status === 'completed' ? 'Completed' : 'Active'} tone={course.status === 'completed' ? 'success' : 'info'} />
            </div>
            <h3 className="mt-4 text-xl font-semibold text-[var(--color-text)]">{course.name}</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{course.code} · Batch {course.batch} · Enrolled {new Date(course.enrollmentDate).toLocaleDateString()}</p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p className="text-[var(--color-muted)]">Progress: {course.progress === null ? 'Not recorded' : `${course.progress}%`}</p>
              <p className="text-[var(--color-muted)]">Attendance: {course.attendancePercent === null ? 'Not recorded' : `${course.attendancePercent}%`}</p>
              <p className="text-[var(--color-muted)]">Instructor: {course.instructor ?? 'Not available'}</p>
              <p className="text-[var(--color-muted)]">Duration: {course.duration ?? 'Not available'}</p>
              <p className="text-[var(--color-muted)] sm:col-span-2">Current topic: {course.currentTopic ?? 'Not recorded'}</p>
            </div>
            <Link to="/student/learning" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">Continue Learning <ArrowRight className="h-4 w-4" /></Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
