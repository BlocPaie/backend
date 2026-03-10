import 'dotenv/config';
import { connectDB } from './config/db';
import { app } from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function main() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`BlocPaie backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
