import { beforeAll, afterAll } from 'bun:test';
import { deleteDatabase, createMessagesTable, checkDatabaseExist } from '../app/helper';
beforeAll(async () => {
	Bun.env.DB_NAME = 'testing.sqlite';
	console.log('\nInitializing beforeAll hook..\n');
	let dbExist = await checkDatabaseExist();
	try {
		if (dbExist) {
			await deleteDatabase();
		}
		console.log(`Creating test database: ${Bun.env.DB_NAME}`);
		await createMessagesTable();
		dbExist = await checkDatabaseExist();
		console.log(` Test database exist: ${dbExist}\n`);
	} catch (error) {
		console.error(`Error in beforeAll: ${error}`);
	}
});

afterAll(async () => {
	console.log('\nInitializing afterAll hook..\n');
	let dbExist = await checkDatabaseExist();
	try {
		if (dbExist) {
			await deleteDatabase();
		}
		dbExist = await checkDatabaseExist();
		console.log(` Test database exist: ${dbExist}`);
		Bun.env.DB_NAME = 'db.sqlite';
		console.log(`Finishing afterAll hook \n Set database to: ${Bun.env.DB_NAME}\n`);
	} catch (error) {
		console.error(`Error in beforeAll: ${error}`);
	}
});
