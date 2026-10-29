import { createOkeyServer } from './server';

const port = Number(process.env.PORT ?? 3001);
const server = createOkeyServer({
  botDelayMs: Number(process.env.BOT_DELAY_MS ?? 1000),
  turnTimeoutMs: Number(process.env.TURN_TIMEOUT_MS ?? 60_000),
});
server.listen(port).then((p) => console.log(`Okey 101 sunucusu :${p} portunda`));
