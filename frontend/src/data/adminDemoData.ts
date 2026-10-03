// Temporary demo data — replace with API response during backend integration.

export const adminOverview = {
  stats: [
    { label: 'Total Students', value: '1240', note: '+8.4% this term' },
    { label: 'Active Courses', value: '42', note: '12 new courses' },
    { label: 'Pending Payments', value: '$38.4K', note: '18 students' },
    { label: 'Open Complaints', value: '18', note: '5 high priority' },
  ],
  studentActivity: [
    { student: 'Aisha Morgan', trend: '+12% engagement', status: 'Healthy' },
    { student: 'Jordan Lee', trend: '+8% attendance', status: 'Stable' },
    { student: 'Priya Shah', trend: '-4% streaming', status: 'Needs review' },
  ],
  alerts: [
    { title: 'High Priority Issues', value: '07', detail: 'Escalations ready' },
    { title: 'AI-Detected Issues', value: '14', detail: 'Classified by category' },
    { title: 'Auto-Categorized Tickets', value: '31', detail: 'Ready for admin review' },
    { title: 'Escalation Required', value: '03', detail: 'Finance + Academic' },
  ],
};
