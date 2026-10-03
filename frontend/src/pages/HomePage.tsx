import { ArrowRight, BrainCircuit, Building2, MessageSquareText, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

const featureList = [
  { title: 'Student Experience', text: 'Clear support journeys, guided learning pathways, and proactive encouragement.', icon: ShieldCheck },
  { title: 'AI-Powered Support', text: 'Structured guidance and issue classification that helps students get answers faster.', icon: BrainCircuit },
  { title: 'Academy Management', text: 'Course operations, payments, records, and schedules in a single platform.', icon: Building2 },
  { title: 'Complaint Resolution', text: 'Turn student concerns into actionable workflows with accountability and visibility.', icon: MessageSquareText },
];

export function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="grid gap-10 py-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div>
          <span className="inline-flex items-center rounded-full border border-[var(--color-primary)] bg-[var(--color-card)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
            AI-powered student support
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-[var(--color-text)] md:text-6xl">
            Smarter Academy Management.<br />
            Better Student Support.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-[var(--color-muted)]">
            AI Academy360 connects student learning, academy operations, AI-driven support, and complaint resolution into one trusted experience.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/login">
              <Button variant="primary" size="lg">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" size="lg">Explore Platform</Button>
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background)] text-[var(--color-primary)]">
              <Building2 className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-semibold text-[var(--color-text)]">Management Login</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">Manage students, courses, payments, complaints and academy operations.</p>
            <Link to="/management/login" className="mt-5 block">
              <Button variant="primary" className="w-full">Management Login</Button>
            </Link>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background)] text-[var(--color-primary)]">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-semibold text-[var(--color-text)]">Student / Learner Login</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">Access courses, schedule, payments, certificates, internships and AI support.</p>
            <Link to="/login/student" className="mt-5 block">
              <Button variant="secondary" className="w-full">Student Login</Button>
            </Link>
          </Card>
        </div>

        <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-[0_18px_46px_rgba(6,59,45,0.08)]">
          <div className="rounded-2xl bg-[var(--color-green)] p-5 text-[var(--color-card)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-card)]/70">Live overview</p>
                <h2 className="mt-2 text-2xl font-semibold">Student support</h2>
              </div>
              <div className="rounded-xl bg-[var(--color-primary)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">AI</div>
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-xl border border-[var(--color-card)]/10 bg-[var(--color-card)]/5 p-3">
                <div className="text-xs text-[var(--color-card)]/70">Student Request</div>
                <div className="mt-1 text-sm font-medium text-[var(--color-card)]">Course schedule conflict</div>
              </div>
              <div className="rounded-xl border border-[var(--color-card)]/10 bg-[var(--color-card)]/5 p-3">
                <div className="text-xs text-[var(--color-card)]/70">AI Analysis</div>
                <div className="mt-1 text-sm font-medium text-[var(--color-card)]">Academic category / medium priority</div>
              </div>
              <div className="rounded-xl border border-[var(--color-card)]/10 bg-[var(--color-card)]/5 p-3">
                <div className="text-xs text-[var(--color-card)]/70">Admin Response</div>
                <div className="mt-1 text-sm font-medium text-[var(--color-card)]">Timetable correction issued</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {featureList.map(({ title, text, icon: Icon }) => (
          <Card key={title} className="p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background)] text-[var(--color-primary)]">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{text}</p>
          </Card>
        ))}
      </section>

      <section className="mt-20 rounded-[32px] bg-[var(--color-green)] p-6 text-[var(--color-card)] md:p-8">
        <div className="mb-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-card)]/70">Workflow</p>
          <h2 className="mt-2 text-3xl font-semibold">From student request to confident resolution</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {['Student Request', 'AI Analysis', 'Smart Ticket', 'Admin Resolution', 'Student Feedback'].map((step, index) => (
            <div key={step} className="rounded-2xl border border-[var(--color-card)]/10 bg-[var(--color-card)]/5 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-card)]">{index + 1}</div>
              <p className="text-sm font-medium text-[var(--color-card)]">{step}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
