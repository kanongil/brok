# brok

Brotli encoder and decoder for hapi.js.

[![Build Status](https://travis-ci.org/kanongil/brok.svg?branch=master)](https://travis-ci.org/kanongil/brok)

Lead Maintainer - [Gil Pedersen](https://github.com/kanongil)

## Install

```sh
npm install brok
```

Note: Node must be version `^10.16` or `>= 12.4` with native brotli support.
If you need it to work with other versions, use `brok@3`.

## Example

### Registration

Registration with custom quality default:

```js
'use strict';

const Hapi = require('@hapi/hapi');
const Brok = require('brok');

const server = new Hapi.Server({ port: 3000, compression: { minBytes: 1 } });

const provision = async () => {

    server.route({
        method: 'GET',
        path: '/fetch',
        handler() {

            return 'ok';
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
```

## Usage

Once registered, **brok** enables the server to negotiate and handle the `"br"` encoding for
compressible responses and uploads.

### Registration options

**brok** accepts the following registration options:

  - `compress` - compression settings.
    Set to `false` to disable response compression using brotli.
      - `quality` - used to adjust compression speed vs quality from 0 to 11.
        Defaults to `5`.
      - `mode` - compression mode.
        Available values:
        - `'generic'` - default compression mode. Default value.
        - `'text'` - optimize for UTF-8 formatted text input.
  - `decompress` - if `true`, also register the encoding for decompressing incoming payloads.
    Do not enable unless required (see security note).
    Defaults to `false`.

### Compression options

Route specific settings can be set using `br` object in the `compression` config. Eg.

```js
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
```
