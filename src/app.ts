import express, { Request, Response } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import companiesRouter from './routes/registry/companies';
import contractorsRouter from './routes/registry/contractors';
import vaultsRouter from './routes/registry/vaults';
import addressMappingsRouter from './routes/registry/addressMappings';
import invoicesRouter from './routes/invoices/index';

const app = express();

// CORS — FRONTEND_URL may be comma-separated for multiple origins
const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Body parsing middleware
app.use(express.json());

// Registry routes
app.use('/api/registry/companies', companiesRouter);
app.use('/api/registry/contractors', contractorsRouter);
app.use('/api/registry/vaults', vaultsRouter);
app.use('/api/registry/address-mappings', addressMappingsRouter);

// Invoice routes
app.use('/api/invoices', invoicesRouter);

// 404 handler for unknown routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested route does not exist',
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export { app };
