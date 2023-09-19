import { deleteDatabase } from '../app/helper';

const testingdb = 'testing.sqlite';
const database = Bun.env.DB_NAME;
(async () => {
	await deleteDatabase();
})();
