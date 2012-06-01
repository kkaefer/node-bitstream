# Bitstream

Stream bits without aligning them to a byte boundary.

# Usage

```js
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
```
