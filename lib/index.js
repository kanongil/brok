'use strict';

// Load modules

const Hoek = require('@hapi/hoek');
const Joi = require('@hapi/joi');
const Iltorb = require('iltorb');
const Zlib = require('zlib');

// Declare internals

const internals = {
    compressionModes: new Map([['generic', 0], ['text', 1]]),
    modeKey: 'mode',
    qualityKey: 'quality',
    defaults: {
        decompress: false,
        native: false,
        compress: {
            mode: 'generic',
            quality: 5
        }
    }
};


internals.schema = Joi.object({
    decompress: Joi.boolean(),
    native: Joi.boolean(),
    compress: Joi.object({
        mode: Joi.string().valid(...internals.compressionModes.keys()),
        quality: Joi.number().integer().min(0).max(11)
    }).allow(false)
});


exports.plugin = {
    pkg: require('../package.json'),

    register(server, registerOptions) {

        let { defaults, schema, compressionModes, modeKey, qualityKey } = internals;
        const { compress, decompress, native } = Joi.attempt(Hoek.applyToDefaults(defaults, registerOptions), schema, 'Invalid options');

        let canUseNative = false;
        /* $lab:coverage:off$ */
        if (native && 'brotliCompress' in Zlib) {
            compressionModes = new Map([
                ['generic', Zlib.constants.BROTLI_MODE_GENERIC],
                ['text', Zlib.constants.BROTLI_MODE_TEXT]
            ]);
            modeKey = Zlib.constants.BROTLI_PARAM_MODE;
            qualityKey = Zlib.constants.BROTLI_PARAM_QUALITY;
            canUseNative = true;
        }
        /* $lab:coverage:on$ */

        if (compress) {
            const compressOptions = {
                [modeKey]: compressionModes.get(compress.mode),
                [qualityKey]: compress.quality
            };

            server.encoder('br', (options) => {

                if (options) {
                    options = {
                        mode: compressionModes.get(options.mode),
                        quality: typeof options.quality === 'number' ? options.quality : undefined
                    };
                }

                options = options ? Hoek.applyToDefaults(compressOptions, options) : compressOptions;
                /* $lab:coverage:off$ */
                if (canUseNative && native) {
                    return Zlib.createBrotliCompress(options);
                }
                /* $lab:coverage:on$ */

                return Iltorb.compressStream(options);
            });
        }

        if (decompress) {
            /* $lab:coverage:off$ */
            if (canUseNative && native) {
                server.decoder('br', Zlib.createBrotliDecompress);
            }
            /* $lab:coverage:on$ */
            else {
                server.decoder('br', Iltorb.decompressStream);
            }
        }
    }
};
