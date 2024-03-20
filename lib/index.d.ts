import { BrotliCompress, BrotliDecompress } from 'zlib';

import { Plugin } from '@hapi/hapi';

interface BrokEncodeOptions {

    mode?: 'generic' | 'text';

    quality?: number;
}

interface BrokOptions {

    decompress?: boolean;

    compress?: BrokEncodeOptions | false;
}

export const plugin: Plugin<BrokOptions> & {
    pkg: {
        name: 'brok',
        version: string
    };
};

// Extend hapi typings

declare module '@hapi/hapi' {
    interface ContentEncoders {
        /**
         * Allow compressing outgoing stream using brotli.
         */
        br: (options?: BrokEncodeOptions) => BrotliCompress;
    }

    interface ContentDecoders {
        /**
         * Alllow decompressing incoming stream using brotli.
         */
        br: () => BrotliDecompress;
    }
}
