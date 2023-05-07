const {
	GROUP_ID,
	FWD_CHANNEL_ID,
	REACTION_LIMIT,
	NODE_ENV,
	INTERVAL,
} = require('./configs/config');

const { main, client } = require('./app/app');

/* console.log(`Running on: ${NODE_ENV}`);

(`Reaction limit is: ${REACTION_LIMIT}`);
console.log(`Group id is: ${GROUP_ID}`);
console.log(`FWD channel id is: ${FWD_CHANNEL_ID}`); */

(async () => {
	 await client.connect();

	setInterval(() => {
		main();
	  }, INTERVAL);
})();
