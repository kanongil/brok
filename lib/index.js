'use strict';

// Load modules

const Hoek = require('hoek');
const Joi = require('joi');
const Iltorb = require('iltorb');

// Declare internals

const internals = {
    compressionModes: new Map([['generic', 0], ['text', 1]]),
    defaults: {
        decompress: false,
        compress: {
            mode: 'generic',
            quality: 5
        }
    }
};


internals.schema = Joi.object({
    decompress: Joi.boolean(),
    compress: Joi.object({
        mode: Joi.string().valid(...internals.compressionModes.keys()),
        quality: Joi.number().integer().min(0).max(11)
    }).allow(false)
});


exports.plugin = {
    pkg: require('../package.json'),

    register(server, registerOptions) {

        const { defaults, schema, compressionModes } = internals;
        const { compress, decompress } = Joi.attempt(Hoek.applyToDefaults(defaults, registerOptions), schema, 'Invalid options');

        if (compress) {
            const compressOptions = {
                mode: compressionModes.get(compress.mode),
                quality: compress.quality
            };

            server.encoder('br', (options) => {

                if (options) {
                    options = {
                        mode: compressionModes.get(options.mode),
                        quality: typeof options.quality === 'number' ? options.quality : undefined
                    };
                }

                options = options ? Hoek.applyToDefaults(compressOptions, options) : compressOptions;
                return Iltorb.compressStream(options);
            });
        }

        if (decompress) {
            server.decoder('br', Iltorb.decompressStream);
        }
    }
};
