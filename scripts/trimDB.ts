import { trimMessagesTable } from '../app/helper';

const database = Bun.env.DB_NAME;
(async () => {
	console.log('trim ->', database);
	await trimMessagesTable({ limit: 5 });
})();
