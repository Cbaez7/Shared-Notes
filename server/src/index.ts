import { createApp } from './app.js';
import { createDatabase } from './database.js';

const port = Number(process.env.PORT ?? 3001);
const app = createApp(createDatabase());
const host = process.env.HOST ?? '0.0.0.0';
app.listen(port, host, () => console.log(`SharedNotes API listening on http://${host}:${port}`));
