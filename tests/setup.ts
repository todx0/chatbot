import { beforeAll, afterAll } from 'bun:test';
import { deleteDatabase, createMessagesTable } from '../app/helper';
beforeAll(async () => {
	Bun.env.DB_NAME = 'testing.sqlite';
	console.log(`Initializing beforeAll hook.. \n Database: ${Bun.env.DB_NAME}`);
	await deleteDatabase();
	await createMessagesTable();
});

afterAll(async () => {
	console.log(`Initializing afterAll hook.. \n Database: ${Bun.env.DB_NAME}`);
	await deleteDatabase();
	Bun.env.DB_NAME = 'db.sqlite';
	console.log(`Finishing afterAll hook.. \n Set database to: ${Bun.env.DB_NAME}`);
});
