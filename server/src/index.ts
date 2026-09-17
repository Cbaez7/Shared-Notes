import { createApp } from './app.js';
import { createDatabase } from './database.js';

const port = Number(process.env.PORT ?? 3001);
const app = createApp(createDatabase());
app.listen(port, () => console.log(`SharedNotes API listening on http://localhost:${port}`));
