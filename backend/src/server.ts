import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { DatabaseConfigurationError, getDatabasePool } from './config/database.js';
import adminRoutes from './routes/admin.routes.js';
import adminAnalyticsRoutes from './routes/adminAnalytics.routes.js';
import adminManagementRoutes from './routes/adminManagement.routes.js';
import adminTicketsRoutes from './routes/adminTickets.routes.js';
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import studentTicketsRoutes from './routes/studentTickets.routes.js';
import { adminNotificationRoutes, studentNotificationRoutes } from './routes/notifications.routes.js';
import certificateRoutes from './routes/certificate.routes.js';
import adminCopilotRoutes from './routes/adminCopilot.routes.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);
const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5174').split(',').map((url) => url.trim());

app.use(
  cors({
    origin: clientUrl,
  }),
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI Academy360 backend is running',
  });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    await getDatabasePool().query('SELECT 1');
    return res.json({ success: true, api: 'running', database: 'connected' });
  } catch (error) {
    return res.status(503).json({
      success: false,
      api: 'running',
      database: 'disconnected',
      message: error instanceof DatabaseConfigurationError ? 'Database is not configured.' : 'Database connection is unavailable.',
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminAnalyticsRoutes);
app.use('/api/admin', adminCopilotRoutes);
app.use('/api/admin', adminManagementRoutes);
app.use('/api/admin', adminTicketsRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/student', studentTicketsRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/student/notifications', studentNotificationRoutes);
app.use('/api/certificates', certificateRoutes);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'AI Academy360 API',
  });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof SyntaxError) {
    return res.status(400).json({ success: false, message: 'Request body is invalid.' });
  }
  return res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

app.listen(port, () => {
  console.log(`AI Academy360 backend listening on http://localhost:${port}`);
});
