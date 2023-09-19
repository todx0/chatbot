import { readRoleContentFromDatabase } from '../app/helper';

const testingdb = 'testing.sqlite';
const database = Bun.env.DB_NAME;
(async () => {
	const res = await readRoleContentFromDatabase();
	console.log(res);
	return res;
})();
