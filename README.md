# brok

Brotli encoder and decoder for hapi.js.

[![Build Status](https://travis-ci.org/kanongil/brok.svg?branch=master)](https://travis-ci.org/kanongil/brok)

Lead Maintainer - [Gil Pedersen](https://github.com/kanongil)

## Example

### Registration

Registration with custom quality default:

```js
'use strict';

const Hapi = require('hapi');
const Brok = require('brok');

const server = new Hapi.Server();
server.connection({ port: 3000 });

server.route({
    method: 'GET',
    path: '/fetch',
    handler: function (request, reply) {

        return reply('ok');
    }
});

server.register({
    register: Brok,
    options: {
        compress: { quality: 3 }
    }
}).then(() => {

    server.start().then(() => {

        console.log('Server running at:', server.info.uri);
    });
});
```

## Usage

Once registered, **brok** enables the server to negotiate and handle the `"br"` encoding for
compressible responses and uploads.

### Registration options

**brok** accepts the following registration options:

  - `decompress` - if `false`, disables registering the encoding for decompression.
    Defaults to `true`.
  - `compress` - compression settings.
    Set to `false` to disable response compression using brotli.
      - `quality` - used to adjust compression speed vs quality from 0 to 11.
        Defaults to `5`.
      - `mode` - compression mode.
        Available values:
        - `'generic'` - default compression mode. Default value.
        - `'text'` - optimize for UTF-8 formatted text input.

### Compression options

Route specific settings can be set using `br` object in the `compression` config. Eg.

```js
server.route({
    method: 'GET',
    path: '/text',
    config: {
        handler: function (request, reply) {

            return reply('hello!');
        },
        compression: {
            br: { mode: 'text' }
        }
    }
});
```
