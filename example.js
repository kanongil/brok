'use strict';

const Hapi = require('hapi');
const Brok = require('.');

const server = new Hapi.Server({ port: 3000, compression: { minBytes: 1 } });

const provision = async () => {

    server.route({
        method: 'GET',
        path: '/fetch',
        handler() {

            return 'ok';
        }
    });

    server.route({
        method: 'GET',
        path: '/text',
        config: {
            handler() {

                return 'hello!';
            },
            compression: {
                br: { mode: 'text' }
            }
        }
    });

    await server.register({
        plugin: Brok,
        options: {
            compress: { quality: 3 }
        }
    });

    await server.start();

    console.log('Server running at:', server.info.uri);
};

provision();
