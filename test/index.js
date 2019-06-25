'use strict';

const Brok = require('..');
const Code = require('@hapi/code');
const Hapi = require('@hapi/hapi');
const Zlib = require('zlib');
const Lab = require('@hapi/lab');

const internals = {};


internals.spyArgs = function (obj, method) {

    return new Promise((resolve) => {

        const origDesc = Object.getOwnPropertyDescriptor(obj, method);
        Object.defineProperty(obj, method, {
            configurable: true,
            value(...args) {

                resolve(args);

                Object.defineProperty(obj, method, origDesc);
                return origDesc.value.call(Zlib, ...args);
            }
        });
    });
};


const lab = exports.lab = Lab.script();
const { describe, it } = lab;
const expect = Code.expect;


describe('brok', () => {

    const provisionServer = async (options) => {

        const server = new Hapi.Server({ compression: { minBytes: 1 } });
        await server.register(options ? { plugin: Brok, options } : Brok);
        return server;
    };

    describe('compression', () => {

        it('is applied to compressable responses', async () => {

            const server = await provisionServer();
            const handler = () => 'compressable';

            server.route({ method: 'GET', path: '/compressable', handler });

            const res = await server.inject({ url: '/compressable', headers: { 'accept-encoding': 'br' } });

            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-encoding']).to.equal('br');
            expect(res.headers['content-length']).to.not.exist();

            const decompressed = Zlib.brotliDecompressSync(res.rawPayload);
            expect(decompressed.length).to.equal(12);
            expect(decompressed.toString()).to.equal('compressable');
        });

        it('handles late registration', async () => {

            const server = new Hapi.Server({ compression: { minBytes: 1 } });
            const handler = () => 'compressable';

            server.route({ method: 'GET', path: '/compressable', config: { handler, compression: { br: {} } } });

            await server.register(Brok);

            const res = await server.inject({ url: '/compressable', headers: { 'accept-encoding': 'br' } });

            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-encoding']).to.equal('br');
            expect(res.headers['content-length']).to.not.exist();

            const decompressed = Zlib.brotliDecompressSync(res.rawPayload);
            expect(decompressed.length).to.equal(12);
            expect(decompressed.toString()).to.equal('compressable');
        });

        it('requires accept-encoding', async () => {

            const server = await provisionServer();
            const handler = () => 'compressable';

            server.route({ method: 'GET', path: '/compressable', handler });

            const res = await server.inject('/compressable');

            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-encoding']).to.not.exist();
            expect(res.payload.length).to.equal(12);
            expect(res.payload).to.equal('compressable');
        });

        it('can be disabled', async () => {

            const server = await provisionServer({ compress: false });
            const handler = () => 'compressable';

            server.route({ method: 'GET', path: '/compressable', handler });

            const res = await server.inject({ url: '/compressable', headers: { 'accept-encoding': 'br' } });

            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-encoding']).to.not.exist();
            expect(res.payload.length).to.equal(12);
            expect(res.payload).to.equal('compressable');
        });

        it('supports mode option', async () => {

            const server = await provisionServer({ compress: { mode: 'text' } });
            const handler = () => ({ hello: 'world' });

            server.route({ method: 'GET', path: '/compressable', handler });

            const promise = internals.spyArgs(Zlib, 'createBrotliCompress');
            const res = await server.inject({ url: '/compressable', headers: { 'accept-encoding': 'br' } });
            const [compressOptions] = await promise;

            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-encoding']).to.equal('br');
            expect(res.headers['content-length']).to.not.exist();

            const decompressed = Zlib.brotliDecompressSync(res.rawPayload);
            expect(JSON.parse(decompressed.toString())).to.equal({ hello: 'world' });

            expect(compressOptions.params).to.contain({
                [Zlib.constants.BROTLI_PARAM_MODE]: Zlib.constants.BROTLI_MODE_TEXT
            });
        });

        it('handles route compression options', async () => {

            const server = await provisionServer();
            const handler = () => ({ hello: 'world' });

            server.route({ method: 'GET', path: '/text', config: { handler, compression: { br: { mode: 'text' } } } });
            server.route({ method: 'GET', path: '/quality', config: { handler, compression: { br: { quality: 1 } } } });

            const promise1 = internals.spyArgs(Zlib, 'createBrotliCompress');
            const res1 = await server.inject({ url: '/text', headers: { 'accept-encoding': 'br' } });
            const [compressOptions1] = await promise1;

            expect(res1.statusCode).to.equal(200);
            expect(res1.headers['content-encoding']).to.equal('br');
            expect(res1.headers['content-length']).to.not.exist();
            expect(JSON.parse(Zlib.brotliDecompressSync(res1.rawPayload).toString())).to.equal({ hello: 'world' });
            expect(compressOptions1.params).to.contain({
                [Zlib.constants.BROTLI_PARAM_MODE]: Zlib.constants.BROTLI_MODE_TEXT,
                [Zlib.constants.BROTLI_PARAM_QUALITY]: 5
            });

            const promise2 = internals.spyArgs(Zlib, 'createBrotliCompress');
            const res2 = await server.inject({ url: '/quality', headers: { 'accept-encoding': 'br' } });
            const [compressOptions2] = await promise2;

            expect(res2.statusCode).to.equal(200);
            expect(res2.headers['content-encoding']).to.equal('br');
            expect(res2.headers['content-length']).to.not.exist();
            expect(JSON.parse(Zlib.brotliDecompressSync(res2.rawPayload).toString())).to.equal({ hello: 'world' });
            expect(compressOptions2.params).to.contain({
                [Zlib.constants.BROTLI_PARAM_MODE]: Zlib.constants.BROTLI_MODE_GENERIC,
                [Zlib.constants.BROTLI_PARAM_QUALITY]: 1
            });
        });

        it('throws on unknown options', async () => {

            const fn = (options) => {

                return provisionServer({ compress: options });
            };

            await expect(fn(true)).to.reject();
            await expect(fn({ mode: 0 })).to.reject();
            await expect(fn({ mode: 'test' })).to.reject();
            await expect(fn({ quality: 3.4 })).to.reject();
            await expect(fn({ unknown: true })).to.reject();
        });
    });

    describe('decompression', () => {

        it('is not enabled by default', async () => {

            let handled = false;

            const server = await provisionServer();
            const handler = (request) => {

                handled = true;
                return request.payload;
            };

            server.route({ method: 'POST', path: '/upload', handler });

            const buf = Zlib.brotliCompressSync(Buffer.from('{"hello":"world"}'));
            const request = {
                method: 'POST',
                url: '/upload',
                headers: {
                    'content-type': 'application/json',
                    'content-encoding': 'br',
                    'content-length': buf.length
                },
                payload: buf
            };

            const res = await server.inject(request);

            expect(res.statusCode).to.equal(400);
            expect(handled).to.equal(false);
        });

        it('is supported for compressed requests', async () => {

            const server = await provisionServer({ decompress: true });
            const handler = (request) => request.payload;

            server.route({ method: 'POST', path: '/upload', handler });

            const buf = Zlib.brotliCompressSync(Buffer.from('{"hello":"world"}'));
            const request = {
                method: 'POST',
                url: '/upload',
                headers: {
                    'content-type': 'application/json',
                    'content-encoding': 'br',
                    'content-length': buf.length
                },
                payload: buf
            };

            const res = await server.inject(request);

            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-length']).to.equal(17);
            expect(res.headers['content-type']).to.contain('application/json');
            expect(res.result).to.equal({ hello: 'world' });
        });

        it('returns 400 for invalid payload', async () => {

            const server = await provisionServer({ decompress: true });
            const handler = (request) => request.payload;

            server.route({ method: 'POST', path: '/upload', handler });

            const buf = Buffer.from('hello world');
            const request = {
                method: 'POST',
                url: '/upload',
                headers: {
                    'content-type': 'application/json',
                    'content-encoding': 'br',
                    'content-length': buf.length
                },
                payload: buf
            };

            const res = await server.inject(request);

            expect(res.statusCode).to.equal(400);
            expect(res.headers['content-type']).to.contain('application/json');
            expect(res.result).to.contain({ message: 'Invalid compressed payload' });
        });

        it('throws on unknown options', async () => {

            const fn = (options) => {

                return provisionServer({ decompress: options });
            };

            await expect(fn({})).to.reject();
            await expect(fn(10)).to.reject();
        });
    });
});
