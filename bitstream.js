module.exports = Bitstream;
require('util').inherits(Bitstream, require('stream'));
function Bitstream() {
    this._buffer = new Buffer(Bitstream.BUFFER_SIZE);
    this._pos = 0;   // Number of current byte.
    this._intra = 0; // Number of bits written in current byte.
    this._total = 0; // Number of bits that has been added to this stream.
}

Bitstream.BUFFER_SIZE = 1024;


// byte is a Number.
Bitstream.prototype.addByte = function(bits) {
    if (this._intra === 0) {
        // Aligned at byte boundary.
        this._buffer[this._pos++] = bits;
    } else {
        // Copy first portion to current byte.
        this._buffer[this._pos] |= bits << this._intra;

        // Copy second portion to next byte.
        if (++this._pos == this._buffer.length) this.flush();
        this._buffer[this._pos] = (bits & 0xFF) >> (8 - this._intra);
    }

    this._total += 8;
};

Bitstream.prototype._addBits = function(bits, length) {
    // Make sure we're not accidentally setting bits that shouldn't be set.
    bits &= (1 << length) - 1;

    if (this._intra === 0) {
        // Aligned at byte boundary.
        this._buffer[this._pos] = bits;
    } else {
        // Number of bits we can fit into the current byte.
        // node's Buffer implementation clamps this to 0xFF.
        this._buffer[this._pos] |= bits << this._intra;

        var current = 8 - this._intra;
        if (current < length) {
            // We also have to add bits to the second byte.
            if (++this._pos == this._buffer.length) this.flush();
            this._buffer[this._pos] = bits >> current;
        }
    }

    this._total += length;
    this._intra += length;

    if (this._intra >= 8) {
        this._intra -= 8;
        this._pos++;
    }
};

/**
 * Adds bits to the bitstream
 *
 * @param bits {Buffer} Contains the bits to add, aligned at position 0.
 *                      Bits are | 76543210 | FEDCBA98 | etc.
 * @param length {Number} Amount of valid bits in the buffer.
 */
Bitstream.prototype.addBits = function(bits, length) {
    if (!this._buffer) throw new Error('Stream is closed');

    var remainder = length % 8;
    var max = (length - remainder) / 8;

    if (bits.length < max || (remainder > 0 && bits.length == max)) {
        throw new Error(length + ' bits expected, but ' + (bits.length * 8) + ' passed');
    }

    if (this._intra === 0) {
        // Do an aligned copy.
        if (this._pos + max < this._buffer.length) {
            // Copy the bits if they fit in the current buffer.
            if (max > 0) {
                bits.copy(this._buffer, this._pos, 0, max);
                this._pos += max;
            }
        } else {
            // The new bits wouldn't fit into the current buffer anyway, so flush
            // and passthrough the new bits.
            this.flush();
            this.emit('data', bits.slice(0, max));
        }
        this._total += max * 8;
    } else {
        // Do unaligned copy.
        for (var pos = 0; pos < max; pos++) {
            this.addByte(bits[pos]);
        }
    }

    // Add last byte.
    if (remainder) {
        this._addBits(bits[max], remainder);
    }
};

Bitstream.prototype.end = function() {
    this.align();
    this.flush();
    this.emit('end');
    delete this._buffer;
    delete this._pos;
};

// Aligns to stream to the next byte boundary by adding zeros.
Bitstream.prototype.align = function(boundary) {
    if (typeof boundary == 'undefined' || boundary < 0 || !boundary) {
        boundary = 1;
    }

    if (boundary > Bitstream._nulls.length) {
        throw new Error('Maximum boundary align size is ' + Bitstream._nulls.length);
    }

    var valid = this._total % (boundary * 8);
    if (valid > 0) {
        this.addBits(Bitstream._nulls, boundary * 8 - valid);
    }
};

// Flushes the current buffer.
Bitstream.prototype.flush = function() {
    // Emit all valid whole bytes that have been written so far.
    this.emit('data', this._buffer.slice(0, this._pos));

    // Clean out the buffer and copy the last partial byte that we didn't emit yet.
    var buffer = new Buffer(Bitstream.BUFFER_SIZE);
    buffer[0] = this._buffer[this._pos];
    this._buffer = buffer;
    this._pos = 0;
};

// Stream API
// Emit 'data', 'end', 'close', 'error'
Bitstream.prototype.readable = true;
Bitstream.prototype.writable = false; // We don't support being piped into; just adding bits with .add()

Bitstream._nulls = new Buffer(32);
Bitstream._nulls.fill(0);
