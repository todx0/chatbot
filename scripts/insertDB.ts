import { insertToMessages } from '../app/helper';

const database = Bun.env.DB_NAME;
(async () => {
	console.log('insert to ->', database);
	await insertToMessages({ role: 'user', content: 'test' });
})();
