import { Server } from '@hapi/hapi';
import * as Lab from '@hapi/lab';
import * as Brok from '..';

const { expect } = Lab.types;

const server = new Server();
await server.register(Brok);

await new Server().register({ plugin: Brok });
await new Server().register({ plugin: Brok, options: { compress: {}, decompress: true } });
expect.error(await new Server().register({ plugin: Brok, options: { decompress: 'yes' } }));

const handler = () => 'ok';

server.route({ method: 'GET', path: '/', handler, options: { compression: { br: { mode: 'generic' } } } });

expect.error(server.route({ method: 'GET', path: '/', handler, options: { compression: { br: { mode: 'custom' }}}}));
