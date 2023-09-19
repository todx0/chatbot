import { insertToMessages } from '../app/helper';

(async () => {
	await insertToMessages({ role: 'user', content: 'test' });
})();
