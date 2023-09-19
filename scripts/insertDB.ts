import { insertToMessages } from '../app/helper';

const testingdb = 'testing.sqlite';
const database = Bun.env.DB_NAME;
(async () => {
	console.log('insert to ->', database);
	await insertToMessages({ role: 'user', content: 'test' });
})();
