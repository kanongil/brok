# brok

Brotli encoder and decoder for hapi.js.

[![Build Status](https://travis-ci.org/kanongil/brok.svg?branch=master)](https://travis-ci.org/kanongil/brok)

Lead Maintainer - [Gil Pedersen](https://github.com/kanongil)

## Install

On Windows, in order to compile the native bindings, it is recommended to install the [windows-build-tools](https://github.com/felixrieseberg/windows-build-tools) beforehand.

On Linux, a recent g++ compiler is required.

```sh
npm install brok
```

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
        handler: function (request, reply) {

            return reply('hello!');
        },
        compression: {
            br: { mode: 'text' }
        }
    }
});
```

### Security and performance

Warning: The compression and de-compression uses the `iltorb` module, which compiles and executes native code.
This ensures optimal performance, however it also enables additional potential attack vectors against your server. In the default configuration, with de-compression disabled, the potential is quite limited, though still present when handling user generated content.

With de-compression enabled, the attack surface expands significantly. As such, it should probably be avoided unless you have taken measures to protect the server, and can show a clear gain from enabling it.
