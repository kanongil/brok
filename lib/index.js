'use strict';

const Zlib = require('zlib');

const Hoek = require('@hapi/hoek');
const Validate = require('@hapi/validate');


const internals = {
    compressionModes: new Map([
        ['generic', Zlib.constants.BROTLI_MODE_GENERIC],
        ['text', Zlib.constants.BROTLI_MODE_TEXT]
    ]),
    defaults: {
        decompress: false,
        compress: {
            mode: 'generic',
            quality: 5
        }
    }
};


exports.plugin = {
    pkg: require('../package.json'),

    register(server, registerOptions) {

        Hoek.assert(Zlib.createBrotliCompress, 'Native brotli is not supported in this version of node');

        const schema = Validate.object({
            decompress: Validate.boolean(),
            compress: Validate.object({
                mode: Validate.string().valid(...internals.compressionModes.keys()),
                quality: Validate.number().integer().min(Zlib.constants.BROTLI_MIN_QUALITY).max(Zlib.constants.BROTLI_MAX_QUALITY)
            }).allow(false)
        });

        const { defaults, compressionModes } = internals;
        const { compress, decompress } = Validate.attempt(Hoek.applyToDefaults(defaults, registerOptions), schema, 'Invalid options');

        if (compress) {
            const compressOptions = {
                [Zlib.constants.BROTLI_PARAM_MODE]: compressionModes.get(compress.mode),
                [Zlib.constants.BROTLI_PARAM_QUALITY]: compress.quality
            };

            server.encoder('br', (params) => {

                if (params) {
                    params = {
                        [Zlib.constants.BROTLI_PARAM_MODE]: compressionModes.get(params.mode),
                        [Zlib.constants.BROTLI_PARAM_QUALITY]: typeof params.quality === 'number' ? params.quality : undefined
                    };
                }

                params = params ? Hoek.applyToDefaults(compressOptions, params) : compressOptions;

                return Zlib.createBrotliCompress({ params });
            });
        }

        if (decompress) {
            server.decoder('br', Zlib.createBrotliDecompress);
        }
    }
};
