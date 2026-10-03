// Temporary demo data — replace with API response during backend integration.

export const studentOverview = {
  greeting: 'Good morning, Student 👋',
  subtitle: 'Here’s your learning and academy overview.',
  stats: [
    { label: 'Active Courses', value: '05', trend: '+2 this term' },
    { label: 'Attendance', value: '94%', trend: 'Strong attendance' },
    { label: 'Pending Tasks', value: '04', trend: '2 due this week' },
    { label: 'Certificates', value: '03', trend: '1 ready to review' },
  ],
  continueLearning: [
    {
      title: 'Advanced Analytics in Practice',
      instructor: 'Dr. Celia Morgan',
      progress: 72,
      nextLesson: 'Module 04: Insight synthesis',
      status: 'In progress',
    },
    {
      title: 'AI Ethics & Governance',
      instructor: 'Prof. Aaron Stone',
      progress: 48,
      nextLesson: 'Framework review',
      status: 'On track',
    },
  ],
  schedule: [
    { time: '09:00', course: 'Advanced Analytics', instructor: 'Dr. Morgan', status: 'Live class' },
    { time: '11:30', course: 'AI Ethics', instructor: 'Prof. Stone', status: 'Workshop' },
    { time: '15:00', course: 'Data Storytelling', instructor: 'Ms. Nia Hall', status: 'Mentoring' },
  ],
  activities: [
    { label: 'AI support request created', time: '2 hours ago' },
    { label: 'Course progress updated', time: 'Yesterday' },
    { label: 'Certificate submitted for review', time: '3 days ago' },
  ],
};
