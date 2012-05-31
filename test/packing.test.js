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
            bs.addBits(new Buffer([ 0xFF ]), 3);
            bs.addBits(new Buffer([ 0x00 ]), 4);
            bs.addBits(new Buffer([ 0xFF ]), 1);
            bs.addBits(new Buffer([ 0x00 ]), 2);
            bs.addBits(new Buffer([ 0xFF ]), 3);
            bs.end();
            var reference = new Buffer([ 0x87, 0x1C ]);
            assert.deepEqual(blob.buffer, reference);
        });

        it('should handle bitstreams longer than 1 byte correctly', function() {
            var bs = new Bitstream;
            var blob = bs.pipe(new Assembler);
            bs.addBits(new Buffer([ 0xFE, 0xED ]), 16);
            bs.addBits(new Buffer([ 0xFF ]), 3);
            bs.addBits(new Buffer([ 0x00, 0x00 ]), 12);
            bs.addBits(new Buffer([ 0xFF ]), 1);
            bs.end();

            var reference = new Buffer([ 0xFE, 0xED, 0x07, 0x80 ]);
            assert.deepEqual(blob.buffer, reference);
        });

        it('should align bits correctly', function() {
            var bs = new Bitstream;
            var blob = bs.pipe(new Assembler);
            bs.addBits(new Buffer([ 0xFF ]), 3);
            bs.align();
            bs.addBits(new Buffer([ 0xFF, 0xFF ]), 10);
            bs.align(2);
            bs.addBits(new Buffer([ 0xFF ]), 5);
            bs.align();
            bs.addBits(new Buffer([ 0xFF, 0xFF, 0xFF, 0XFF ]), 28);
            bs.align(8);
            bs.addBits(new Buffer([ 0xFF ]), 6);
            bs.align();
            bs.addBits(new Buffer([ 0xFF, 0xFF, 0xFF, 0xFF ]), 26);
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


describe('error handling', function() {
    it('should throw when fewer data than indicated is passed', function() {
        var bs = new Bitstream;
        assert.throws(function() {
            bs.addBits(new Buffer([ 0xFF ]), 12);
        }, '12 bits expected, but 8 passed');
    });

    it('should throw when no data is passed', function() {
        var bs = new Bitstream;
        assert.throws(function() {
            bs.addBits(new Buffer([]), 3);
        }, '3 bits expected, but 0 passed');
    });

    it('should disallow a bogus boundary align size', function() {
        var bs = new Bitstream;
        assert.throws(function() {
            bs.align(50);
        }, 'Maximum boundary align size is 32');
    });

    it('should disallow adding bits after stream is closed', function() {
        var bs = new Bitstream;
        bs.end();
        assert.throws(function() {
            bs.addBits(new Buffer([0xFF]), 8);
        }, 'Stream is closed');
    });
});
