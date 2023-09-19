import { trimMessagesTable } from '../app/helper';

(async () => {
	await trimMessagesTable({ limit: 5 });
})();
