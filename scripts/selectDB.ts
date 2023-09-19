import { readRoleContentFromDatabase } from '../app/helper';

(async () => {
	const res = await readRoleContentFromDatabase();
	console.log(res);
})();
