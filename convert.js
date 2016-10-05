'use strict'

const ba = require('binascii')

// these functions are for padding the blake2b hashes
// for the equihash lists

// function bin (text) {
//     var res = ''
//     var j = 0
//     for (var i = 0 ; i < text.length; i = j) {
//         console.log(j)
//         j += 8; // specify radix--v
//         res += String.fromCharCode( parseInt( text.slice( i, j ), 2 ) );
//     }
//     console.log(res)
//     return res;
// }

// remove spaces from the string
var str = '01010111011010010111001000100000011000100110010101100111011010010110111001101110011001010110111000100000011011010110100101110100001000000110010101110100011101110110000101110011001000000110010101101001011011100110011001100001011000110110100001100101011011010010111000100000010101110110010101101110011011100010000001100100011101010010000001100100011010010110010101110011001000000110110001100101011100110110010101101110001000000110101101100001011011100110111001110011011101000010110000100000011010000110000101110011011101000010000001100100011101010010000001110011011000110110100001101111011011100010000001101000011001010111001001100001011101010111001101100111011001010110011001110101011011100110010001100101011011100010110000100000011001000110000101110011011100110010000001100100011010010110010101110011011001010111001000100000010101000110010101111000011101000110001001101100011011110110001101101011001000000110010101101001011011100110010100100000011000100110100101101110011000010110010101110010011001010010000001000100011000010111001001110011011101000110010101101100011011000111010101101110011001110010000001100100011001010111001100100000010101000110010101111000011101000110010101110011001000000110100101110011011101000010110000100000011001000110010101101110001000000110010001110101001000000110011101100101011100100110000101100100011001010010000001101100011010010110010101110011011101000010111000100000010000100110100101110100011101000110010100100000011110100110000101100101011010000110110001100101001000000110010001101001011001010010000001010111010011110100010101010010010101000100010101010010001000000110010001101001011001010111001101100101011100110010000001000010011011000110111101100011011010110111001100101100001000000111101001101001011001010110100001100101001000000011000100110011001000000110010001100001011101100110111101101110001000000110000101100010001000000111010101101110011001000010000001101110011011110111010001101001011001010111001001100101001000000110010001100001011100110010000001000101011100100110011101100101011000100110111001101001011100110010000001100001011011000111001100100000010110100110000101101000011011000010000001000001';

// convert binary to ascii
var res = str.match(/[01]{8}/g).map(function(v) {
    return String.fromCharCode( parseInt(v,2) )
}).join('')

function dec2bin(dec){
  return (dec >>> 0).toString(2)
}

// Javascript left shift operator only works on 32 bit numbers
function leftShift(number, shift) {
  return number * Math.pow(2, shift)
}

function rightShift(number, shift) {
 return number / Math.pow(2, shift)
}
//console.log(res)

var word_size = 32
var word_mask = leftShift(1, word_size)-1

//var word_mask = 4294967296

console.log(word_mask)

module.exports = {

  expand_array: function (inp, out_len, bit_len) {
    var byte_pad = 0

    //inp = ba.unhexlify(inp.toString('hex'))
    
    //console.log('test')
    if (bit_len < 8 || word_size < 7+bit_len) {
      return
    }

    var bit_len_mask = leftShift(1, bit_len)-1
    //console.log(bit_len_mask)

    var out_width = Math.floor((bit_len+7)/8) + byte_pad
    //console.log(out_len)
    //console.log(8*out_width*inp.length/bit_len)
    //console.log(inp.length)

    if (out_len != 8*out_width*inp.length/bit_len) {
      console.log('88888')
      return
    }

    var out = new Buffer(out_len)

    var acc_bits = 0
    var acc_value = 0

    var j = 0

    for (var i = 0; i < inp.length; i++) {
      acc_value = (leftShift(acc_value, 8) & word_mask) | inp[i]
      //console.log(acc_value)
      // getting negative values here, could be the bitwise ops on 32 bits only in js
      acc_bits += 8

      if (acc_bits >= bit_len) {
        acc_bits -= bit_len
        //console.log('weee')
        for (var x = byte_pad; x < out_width; x++) {
          out[j+x] = (Math.floor(rightShift(acc_value, (acc_bits+(8*(out_width-x-1)))))) & ((Math.floor(rightShift(bit_len_mask, (8*(out_width-x-1))))) & 0xFF)
          //console.log(out[j+x])
          //console.log(Math.floor(rightShift(bit_len_mask, (8*(out_width-x-1)))))
          //console.log(rightShift(acc_value, (acc_bits+(8*(out_width-x-1)))))
        }
        j += out_width
      }
    }
    return out

  },

  compress_array: function (inp, out_len, bit_len) {
    var byte_pad = 0

    if (bit_len < 8 || word_size < 7+bit_len) {
      return
    }

    var in_width = Math.floor((bit_len+7)/8) + byte_pad

    if (out_len != Math.floor(8*in_width*inp.length/bit_len)) {
      return
    }

    var out = new Buffer(out_len)
    var bit_len_mask = leftShift(1, bit_len)-1

    var acc_bits = 0
    var acc_value = 0

    var j = 0

    for (var i = 0; i < out_len; i++) {
      if (acc_bits < 8) {
        acc_value = (leftShift(acc_value, bit_len) & word_mask) | inp[j]
        for (var x = byte_pad; x < in_width; x++) {
          acc_value = acc_value | (
              leftShift((inp[j+x] & ((rightShift(bit_len_mask, (8*(in_width-x-1)))) & 0xFF)), (8*(in_width-x-1)))
            )
        }
        j += in_width
        acc_bits += bit_len
      }
      acc_bits -= 8
      out[i] = (rightShift(acc_value, acc_bits)) & 0xFF
    }

    return out

  }


}

