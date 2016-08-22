'use strict';

// Load modules

const Hoek = require('hoek');
const Joi = require('joi');
const Iltorb = require('iltorb');

// Declare internals

const internals = {
    compressionModes: ['generic', 'text', 'font'],
    defaults: {
        decompress: true,
        compress: {
            mode: 'generic',
            quality: 5
        }
    }
};


internals.schema = Joi.object({
    decompress: Joi.boolean(),
    compress: Joi.object({
        mode: Joi.string().valid('generic', 'text', 'font'),
        quality: Joi.number().integer().min(0).max(11)
    }).allow(false)
});


exports.register = function (server, options, next) {

    const settings = Joi.attempt(Hoek.applyToDefaults(internals.defaults, options), internals.schema, 'Invalid options');

    if (settings.compress) {
        const compressOptions = {
            mode: internals.compressionModes.indexOf(settings.compress.mode),
            quality: settings.compress.quality
        };

        const compressStream = () => {

            return Iltorb.compressStream(compressOptions);
        };

        server.encoder('br', compressStream);
    }

    if (settings.decompress) {
        server.decoder('br', Iltorb.decompressStream);
    }

    return next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};
