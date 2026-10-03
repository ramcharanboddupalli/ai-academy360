import { Router, type Request, type Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import { DatabaseConfigurationError, getDatabasePool } from '../config/database.js';

const router = Router();

router.get('/verify/:certificateNumber', async (req: Request, res: Response) => {
  const certificateNumber = req.params.certificateNumber;
  if (typeof certificateNumber !== 'string' || certificateNumber.trim().length < 1 || certificateNumber.length > 120) {
    return res.status(400).json({ success: false, message: 'Certificate number is invalid.' });
  }
  try {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT cert.certificate_id AS certificateNumber, COALESCE(cert.title, c.title) AS title,
              c.title AS course, cert.status,
              DATE_FORMAT(cert.issued_at, '%Y-%m-%d') AS issueDate
       FROM certificates cert JOIN courses c ON c.id = cert.course_id
       WHERE cert.certificate_id = ? LIMIT 1`,
      [certificateNumber.trim()],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Certificate was not found.' });
    return res.json({
      success: true,
      certificate: {
        ...rows[0],
        verificationStatus: rows[0].status === 'issued' ? 'verified' : rows[0].status,
      },
    });
  } catch (error) {
    const message = error instanceof DatabaseConfigurationError
      ? 'Certificate verification is not configured.'
      : 'Certificate verification is temporarily unavailable.';
    return res.status(503).json({ success: false, message });
  }
});

export default router;
