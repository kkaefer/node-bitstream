var assert = require('assert');
var Bitstream = require('..');

// Helper for assembling streams.
require('util').inherits(Assembler, require('stream'));
function Assembler() {
    var assembler = this;
    this.buffer = new Buffer(0);
    this.on('pipe', function(pipe) {
        pipe.on('data', function(data) {
            var combined = new Buffer(assembler.buffer.length + data.length);
            assembler.buffer.copy(combined, 0);
            data.copy(combined, assembler.buffer.length);
            assembler.buffer = combined;
        });
    });
}
Assembler.prototype.end = function() {};

[1024, 8, 3, 1].forEach(function(size) {
    describe('bit packing with BUFFER_SIZE = ' + size, function() {
        before(function() {
            Bitstream.BUFFER_SIZE = size;
        });

        it('should assemble the stream correctly', function() {
            var bs = new Bitstream;
            var blob = bs.pipe(new Assembler);
            bs.writeBits(new Buffer([ 0xFF ]), 3);
            bs.writeBits(new Buffer([ 0x00 ]), 4);
            bs.writeBits(new Buffer([ 0xFF ]), 1);
            bs.writeBits(new Buffer([ 0x00 ]), 2);
            bs.writeBits(new Buffer([ 0xFF ]), 3);
            bs.end();
            var reference = new Buffer([ 0x87, 0x1C ]);
            assert.deepEqual(blob.buffer, reference);
        });

        it('should handle bitstreams longer than 1 byte correctly', function() {
            var bs = new Bitstream;
            var blob = bs.pipe(new Assembler);
            bs.writeBits(new Buffer([ 0xFE, 0xED ]), 16);
            bs.writeBits(new Buffer([ 0xFF ]), 3);
            bs.writeBits(new Buffer([ 0x00, 0x00 ]), 12);
            bs.writeBits(new Buffer([ 0xFF ]), 1);
            bs.end();

            var reference = new Buffer([ 0xFE, 0xED, 0x07, 0x80 ]);
            assert.deepEqual(blob.buffer, reference);
        });

        it('should write unsigned big endian integers of arbitary bit length', function() {
            var bs = new Bitstream;
            var blob = bs.pipe(new Assembler);
            bs.writeUnsignedBE(0xFEED, 16);
            bs.writeUnsignedBE(0xFF, 3);
            bs.writeUnsignedBE(0x0000, 12);
            bs.writeUnsignedBE(0x1, 1);
            bs.writeUnsignedBE(0x0, 2);
            bs.writeUnsignedBE(0x3, 2);
            bs.writeUnsignedBE(0xA5, 8);
            bs.writeUnsignedBE(0x0, 4);
            bs.writeUnsignedBE(0x1, 1);
            bs.writeUnsignedBE(0x335A, 15);
            bs.end();

            var reference = new Buffer([ 0xFE, 0xED, 0x07, 0x80, 0x5C, 0x0A, 0x67, 0x5A ]);
            assert.deepEqual(blob.buffer, reference);
        });

        it('should write unsigned little endian integers of arbitary bit length', function() {
            var bs = new Bitstream;
            var blob = bs.pipe(new Assembler);
            bs.writeUnsignedLE(0xFEED, 16);
            bs.writeUnsignedLE(0xFF, 3);
            bs.writeUnsignedLE(0x0000, 12);
            bs.writeUnsignedLE(0x1, 1);

            bs.writeUnsignedLE(0x0, 2);
            bs.writeUnsignedLE(0x3, 2);
            bs.writeUnsignedLE(0xA5, 8);
            bs.writeUnsignedLE(0x0, 4);
            bs.writeUnsignedLE(0x1, 1);
            bs.writeUnsignedLE(0x335A, 15);
            bs.end();

            var reference = new Buffer([ 0xED, 0xFE, 0x07, 0x80, 0x5C, 0x0A, 0xB5, 0x66 ]);
            assert.deepEqual(blob.buffer, reference);
        });

        it('should align bits correctly', function() {
            var bs = new Bitstream;
            var blob = bs.pipe(new Assembler);
            bs.writeBits(new Buffer([ 0xFF ]), 3);
            bs.align();
            bs.writeBits(new Buffer([ 0xFF, 0xFF ]), 10);
            bs.align(2);
            bs.writeBits(new Buffer([ 0xFF ]), 5);
            bs.align();
            bs.writeBits(new Buffer([ 0xFF, 0xFF, 0xFF, 0xFF ]), 28);
            bs.align(8);
            bs.writeBits(new Buffer([ 0xFF ]), 6);
            bs.align();
            bs.writeBits(new Buffer([ 0xFF, 0xFF, 0xFF, 0xFF ]), 26);
            bs.align(4);
            bs.end();

            var reference = new Buffer([
                0x07, // align to 1 byte
                0xFF, 0x03, 0x00, // align to 2 bytes
                0x1F, // align to 1 byte
                0xFF, 0xFF, 0xFF, 0x0F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // align to 8 bytes
                0x3F, // align to 1 byte
                0xFF, 0xFF, 0xFF, 0x03, 0x00, 0x00, 0x00 // align to four bytes!
            ]);
            assert.deepEqual(blob.buffer, reference);
        });
    });
});


describe('readme example', function() {
    it('should produce the correct output', function() {
        var target = new Assembler;

        var bs = new Bitstream;
        bs.pipe(target);

        // Adds 1111111 (seven) bits (the first seven on 0xFF);
        bs.writeBits(new Buffer([ 0xFF ]), 7);

        // Adds 10010 (five) bits
        bs.writeUnsigned(0x12, 5);

        // Adds 11111111 (8) bits (directly after the twelve previous bits)
        bs.writeByte(0xFF);

        // Adds 1001000110100 in little endian byte order to the bitstream
        bs.writeUnsignedLE(0x1234, 13);

        // Aligns the stream to an 2 byte boundary (inserting zeros).
        bs.align(2);

        // // Flush cached input (except for the last partial byte, if any)
        bs.flush();

        // Finish stream (flushes implicitly)
        bs.end();

        // Final output of the stream: <Buffer 7f f9 4f 23 01 00>
        // In binary notation: 01111111 11111001 01001111 00100011 00000001 00000000

        assert.deepEqual(target.buffer, new Buffer([ 0x7F, 0xF9, 0x4F, 0x23, 0x01, 0x00 ]));
    });
});


describe('error handling', function() {
    it('should throw when fewer data than indicated is passed', function() {
        var bs = new Bitstream;
        assert.throws(function() {
            bs.writeBits(new Buffer([ 0xFF ]), 12);
        }, '12 bits expected, but 8 passed');
    });

    it('should throw when no data is passed', function() {
        var bs = new Bitstream;
        assert.throws(function() {
            bs.writeBits(new Buffer([]), 3);
        }, '3 bits expected, but 0 passed');
    });

    it('should disallow a bogus boundary align size', function() {
        var bs = new Bitstream;
        assert.throws(function() {
            bs.align(50);
        }, 'Maximum boundary align size is 32');
    });

    it('should disallow writing bits after stream is closed', function() {
        var bs = new Bitstream;
        bs.end();
        assert.throws(function() {
            bs.writeBits(new Buffer([0xFF]), 8);
        }, 'Stream is closed');
    });
});
