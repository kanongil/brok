'use strict';

// Load modules

const Brok = require('..');
const Code = require('code');
const Hapi = require('hapi');
const Iltorb = require('iltorb');
const Lab = require('lab');


// Declare internals

const internals = {};


// Test shortcuts

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

            const decompressed = Iltorb.decompressSync(res.rawPayload);
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

            const decompressed = Iltorb.decompressSync(res.rawPayload);
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

            let compressOptions;
            const origCompressStream = Iltorb.compressStream;
            Iltorb.compressStream = function (options) {

                compressOptions = options;

                Iltorb.compressStream = origCompressStream;
                return origCompressStream.apply(Iltorb, arguments);
            };

            server.route({ method: 'GET', path: '/compressable', handler });

            const res = await server.inject({ url: '/compressable', headers: { 'accept-encoding': 'br' } });

            expect(res.statusCode).to.equal(200);
            expect(res.headers['content-encoding']).to.equal('br');
            expect(res.headers['content-length']).to.not.exist();

            const decompressed = Iltorb.decompressSync(res.rawPayload);
            expect(JSON.parse(decompressed.toString())).to.equal({ hello: 'world' });

            expect(compressOptions).to.contain({ mode: 1 });
        });

        it('handles route compression options', async () => {

            const server = await provisionServer();
            const handler = () => ({ hello: 'world' });

            let compressOptions;
            const origCompressStream = Iltorb.compressStream;
            Iltorb.compressStream = function (options) {

                compressOptions = options;
                return origCompressStream.apply(Iltorb, arguments);
            };

            server.route({ method: 'GET', path: '/text', config: { handler, compression: { br: { mode: 'text' } } } });
            server.route({ method: 'GET', path: '/quality', config: { handler, compression: { br: { quality: 1 } } } });

            const res1 = await server.inject({ url: '/text', headers: { 'accept-encoding': 'br' } });

            expect(res1.statusCode).to.equal(200);
            expect(res1.headers['content-encoding']).to.equal('br');
            expect(res1.headers['content-length']).to.not.exist();
            expect(JSON.parse(Iltorb.decompressSync(res1.rawPayload).toString())).to.equal({ hello: 'world' });
            expect(compressOptions).to.contain({ mode: 1, quality: 5 });

            const res2 = await server.inject({ url: '/quality', headers: { 'accept-encoding': 'br' } });

            Iltorb.compressStream = origCompressStream;

            expect(res2.statusCode).to.equal(200);
            expect(res2.headers['content-encoding']).to.equal('br');
            expect(res2.headers['content-length']).to.not.exist();
            expect(JSON.parse(Iltorb.decompressSync(res2.rawPayload).toString())).to.equal({ hello: 'world' });
            expect(compressOptions).to.contain({ mode: 0, quality: 1 });
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

            const buf = Iltorb.compressSync(Buffer.from('{"hello":"world"}'));
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

            const buf = Iltorb.compressSync(Buffer.from('{"hello":"world"}'));
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
