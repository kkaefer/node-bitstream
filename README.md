# Bitstream

Stream bits without aligning them to a byte boundary.

# Usage

```js
var bs = new Bitstream;
bs.pipe(target);

// Adds 1111111 (seven) bits (the first seven on 0xFF);
bs.addBits(new Buffer([ 0xFF ]), 7);

// Adds 10010 (five) bits
bs.addBits(new Buffer([ 0xD2 ]), 4);

// Adds 11111111 (8) bits (directly after the eleven previous bits)
bs.addByte(255);

// Aligns the stream to an 4 byte boundary (inserting zeros).
bs.align(4);

// Flush cached input (except for the last partial byte, if any)
bs.flush();

// Finish stream (flushes implicitly)
bs.end();

// Final output of the stream: 01111111 11111001 00001111 00000000
```
