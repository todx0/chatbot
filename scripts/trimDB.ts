import { trimMessagesTable } from '../app/helper';

const testingdb = 'testing.sqlite';
const database = Bun.env.DB_NAME;
(async () => {
	console.log('insert to ->', database);
	await trimMessagesTable({ limit: 5 });
})();
