import { deleteDatabase } from '../app/helper';
const testingdb = 'testing.sqlite';

(async () => {
	const result = await deleteDatabase(testingdb);
	console.log(result);
})();
