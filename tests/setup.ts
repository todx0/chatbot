import { beforeAll, afterAll } from 'bun:test';
import { deleteDatabase, createMessagesTable } from '../app/helper';
beforeAll(async () => {
	Bun.env.DB_NAME = 'testing.sqlite';
	try { await deleteDatabase(); } catch (e) { console.log(); }
	await createMessagesTable();
});

afterAll(async () => {
	await deleteDatabase();
	Bun.env.DB_NAME = 'db.sqlite';
});
