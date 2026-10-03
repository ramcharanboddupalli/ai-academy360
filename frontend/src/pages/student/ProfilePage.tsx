import { useEffect, useState } from 'react';
import { UserCircle2 } from 'lucide-react';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { PageHeader } from '../../components/PageHeader';
import { studentService, type StudentProfile } from '../../services/student.service';

export function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    let isMounted = true;
    studentService.getProfile().then((response) => {
      if (isMounted) setProfile(response.data.student);
    }).catch(() => {
      if (isMounted) setProfileError('Your student profile could not be loaded.');
    });
    return () => { isMounted = false; };
  }, []);

  const nameParts = profile?.fullName.split(/\s+/) ?? [];
  const initials = nameParts.map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="My Profile" subtitle="Account and academic details stored by the academy." />

      {!profile && !profileError ? <p role="status" className="mb-5 text-sm text-[var(--color-muted)]">Loading your profile...</p> : null}
      {profileError ? <p role="alert" className="mb-5 text-sm text-[var(--color-primary)]">{profileError}</p> : null}

      {profile ? <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-lg font-semibold text-[var(--color-card)]">{initials || ' '}</div>
            <div>
              <div className="text-lg font-semibold text-[var(--color-text)]">{profile?.fullName ?? (profileError || 'Loading profile...')}</div>
              <div className="text-sm text-[var(--color-muted)]">{profile.status} account</div>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <div className="flex items-center gap-2 text-[var(--color-primary)]"><UserCircle2 className="h-4 w-4" /> Personal summary</div>
            <p className="mt-3 text-sm text-[var(--color-muted)]">Student ID: {profile.studentId} · Joined {profile.joinDate} · Batch {profile.batch}</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="First name" value={nameParts[0] ?? ''} readOnly />
            <Input label="Last name" value={nameParts.slice(1).join(' ')} readOnly />
            <Input label="Email" value={profile?.email ?? ''} readOnly />
            <Input label="Phone" value={profile?.phone ?? ''} readOnly />
            <Input label="Primary course" value={profile.course} readOnly />
            <Input label="Student ID" value={profile?.studentId ?? ''} readOnly />
            <Input label="Cohort" value={profile?.batch ?? ''} className="md:col-span-2" readOnly />
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold text-[var(--color-text)]">Enrolled courses</h2>
          {profile.courses.length ? <ul className="mt-4 divide-y divide-[var(--color-border)]">{profile.courses.map((course) => <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"><span><span className="block font-medium text-[var(--color-text)]">{course.name}</span><span className="mt-1 block text-sm text-[var(--color-muted)]">{course.code} · Batch {course.batch} · Enrolled {new Date(course.enrollmentDate).toLocaleDateString()}</span></span><span className="text-sm capitalize text-[var(--color-muted)]">{course.status}</span></li>)}</ul> : <p className="mt-3 text-sm text-[var(--color-muted)]">No courses have been assigned to your account yet.</p>}
        </Card>
      </div> : null}
    </div>
  );
}
