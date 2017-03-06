'use strict';

// Load modules

const Hoek = require('hoek');
const Joi = require('joi');
const Iltorb = require('iltorb');

// Declare internals

const internals = {
    compressionModes: ['generic', 'text'],
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
        mode: Joi.string().valid(internals.compressionModes),
        quality: Joi.number().integer().min(0).max(11)
    }).allow(false)
});


exports.register = function (server, registerOptions, next) {

    const settings = Joi.attempt(Hoek.applyToDefaults(internals.defaults, registerOptions), internals.schema, 'Invalid options');

    if (settings.compress) {
        const compressOptions = {
            mode: internals.compressionModes.indexOf(settings.compress.mode),
            quality: settings.compress.quality
        };

        server.encoder('br', (options) => {

            if (options) {
                options = {
                    mode: typeof options.mode === 'string' ? internals.compressionModes.indexOf(options.mode) : undefined,
                    quality: typeof options.quality === 'number' ? options.quality : undefined
                };
            }

            options = options ? Hoek.applyToDefaults(compressOptions, options) : compressOptions;
            return Iltorb.compressStream(options);
        });
    }

    if (settings.decompress) {
        server.decoder('br', Iltorb.decompressStream);
    }

    return next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};
