import { zstdCompressSync, zstdDecompressSync, constants } from 'node:zlib';

export function compress(input) {
    const buffer = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
    return zstdCompressSync(buffer, {
        params: { [constants.ZSTD_c_compressionLevel]: 2 },
    });
}


export function decompress(buffer) {
    return zstdDecompressSync(buffer);
}


export function decompressToString(buffer) {
    return zstdDecompressSync(buffer).toString('utf-8');
}
