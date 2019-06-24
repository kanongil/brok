'use strict';

// Load modules

const Hoek = require('@hapi/hoek');
const Joi = require('@hapi/joi');
const Zlib = require('zlib');

// Declare internals

const internals = {
    compressionModes: new Map([
        ['generic', Zlib.constants.BROTLI_MODE_GENERIC],
        ['text', Zlib.constants.BROTLI_MODE_TEXT]
    ]),
    defaults: {
        decompress: false,
        compress: {
            mode: 'generic',
            quality: Zlib.constants.BROTLI_DEFAULT_QUALITY
        }
    }
};


internals.schema = Joi.object({
    decompress: Joi.boolean(),
    compress: Joi.object({
        mode: Joi.string().valid(...internals.compressionModes.keys()),
        quality: Joi.number().integer().min(Zlib.constants.BROTLI_MIN_QUALITY).max(Zlib.constants.BROTLI_MAX_QUALITY)
    }).allow(false)
});


exports.plugin = {
    pkg: require('../package.json'),

    register(server, registerOptions) {

        const { defaults, schema, compressionModes } = internals;
        const { compress, decompress } = Joi.attempt(Hoek.applyToDefaults(defaults, registerOptions), schema, 'Invalid options');

        if (compress) {
            const compressOptions = {
                [Zlib.constants.BROTLI_PARAM_MODE]: compressionModes.get(compress.mode),
                [Zlib.constants.BROTLI_PARAM_QUALITY]: compress.quality
            };

            server.encoder('br', (options) => {

                if (options) {
                    options = {
                        [Zlib.constants.BROTLI_PARAM_MODE]: compressionModes.get(options.mode),
                        [Zlib.constants.BROTLI_PARAM_QUALITY]: typeof options.quality === 'number' ? options.quality : undefined
                    };
                }

                options = options ? Hoek.applyToDefaults(compressOptions, options) : compressOptions;

                return Zlib.createBrotliCompress(options);
            });
        }

        if (decompress) {
            server.decoder('br', Zlib.createBrotliDecompress);
        }
    }
};
