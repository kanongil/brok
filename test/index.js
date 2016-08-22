'use strict';

// Load modules

const Code = require('code');
const Hapi = require('hapi');
const Hoek = require('hoek');
const Iltorb = require('iltorb');
const Lab = require('lab');
const Brok = require('..');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('brok', () => {

    const provisionServer = (options) => {

        const server = new Hapi.Server();
        server.connection();
        server.register(options ? { register: Brok, options } : Brok, Hoek.ignore);
        return server;
    };

    describe('compression', () => {

        it('is applied to compressable responses', (done) => {

            const server = provisionServer();
            const handler = (request, reply) => {

                return reply('compressable');
            };

            server.route({ method: 'GET', path: '/compressable', handler });

            server.inject({ url: '/compressable', headers: { 'accept-encoding': 'br' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-encoding']).to.equal('br');
                expect(res.headers['content-length']).to.not.exist();

                const decompressed = Iltorb.decompressSync(res.rawPayload);
                expect(decompressed.length).to.equal(12);
                expect(decompressed.toString()).to.equal('compressable');

                done();
            });
        });

        it('requires accept-encoding', (done) => {

            const server = provisionServer();
            const handler = (request, reply) => {

                return reply('compressable');
            };

            server.route({ method: 'GET', path: '/compressable', handler });

            server.inject('/compressable', (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-encoding']).to.not.exist();
                expect(res.payload.length).to.equal(12);
                expect(res.payload).to.equal('compressable');

                done();
            });
        });

        it('can be disabled', (done) => {

            const server = provisionServer({ compress: false });
            const handler = (request, reply) => {

                return reply('compressable');
            };

            server.route({ method: 'GET', path: '/compressable', handler });

            server.inject({ url: '/compressable', headers: { 'accept-encoding': 'br' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-encoding']).to.not.exist();
                expect(res.payload.length).to.equal(12);
                expect(res.payload).to.equal('compressable');

                done();
            });
        });

        it('supports mode option', (done) => {

            const server = provisionServer({ compress: { mode: 'text' } });
            const handler = (request, reply) => {

                return reply({ hello: 'world' });
            };

            let compressOptions;
            const origCompressStream = Iltorb.compressStream;
            Iltorb.compressStream = function (options) {

                compressOptions = options;

                Iltorb.compressStream = origCompressStream;
                return origCompressStream.apply(Iltorb, arguments);
            };

            server.route({ method: 'GET', path: '/compressable', handler });

            server.inject({ url: '/compressable', headers: { 'accept-encoding': 'br' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-encoding']).to.equal('br');
                expect(res.headers['content-length']).to.not.exist();

                const decompressed = Iltorb.decompressSync(res.rawPayload);
                expect(JSON.parse(decompressed.toString())).to.equal({ hello: 'world' });

                expect(compressOptions).to.contain({ mode: 1 });

                done();
            });
        });

        it('throws on unknown options', (done) => {

            const fn = (options) => {

                return () => {

                    provisionServer({ compress: options });
                };
            };

            expect(fn(true)).to.throw();
            expect(fn({ mode: 0 })).to.throw();
            expect(fn({ mode: 'test' })).to.throw();
            expect(fn({ quality: 3.4 })).to.throw();
            expect(fn({ unknown: true })).to.throw();
            done();
        });
    });

    describe('decompression', () => {

        it('is supported for compressed requests', (done) => {

            const server = provisionServer();
            const handler = (request, reply) => {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/upload', handler });

            const buf = Iltorb.compressSync(new Buffer('{"hello":"world"}'));
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

            server.inject(request, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.headers['content-length']).to.equal(17);
                expect(res.headers['content-type']).to.contain('application/json');
                expect(res.result).to.equal({ hello: 'world' });
                done();
            });
        });

        it('returns 400 for invalid payload', (done) => {

            const server = provisionServer();
            const handler = (request, reply) => {

                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/upload', handler });

            const buf = new Buffer('hello world');
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

            server.inject(request, (res) => {

                expect(res.statusCode).to.equal(400);
                expect(res.headers['content-type']).to.contain('application/json');
                expect(res.result).to.contain({ message: 'Invalid compressed payload' });
                done();
            });
        });

        it('can be disabled', (done) => {

            let handled = false;

            const server = provisionServer({ decompress: false });
            const handler = (request, reply) => {

                handled = true;
                return reply(request.payload);
            };

            server.route({ method: 'POST', path: '/upload', handler });

            const buf = Iltorb.compressSync(new Buffer('{"hello":"world"}'));
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

            server.inject(request, (res) => {

                expect(res.statusCode).to.equal(400);
                expect(handled).to.equal(false);
                done();
            });
        });

        it('throws on unknown options', (done) => {

            const fn = (options) => {

                return () => {

                    provisionServer({ decompress: options });
                };
            };

            expect(fn({})).to.throw();
            expect(fn(10)).to.throw();
            done();
        });
    });
});
