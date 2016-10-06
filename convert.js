'use strict'

const ba = require('binascii')

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

var word_size = 32
var word_mask = leftShift(1, word_size)-1

module.exports = {

  expand_array: function (inp, out_len, bit_len) {
    var byte_pad = 0

    if (bit_len < 8 || word_size < 7+bit_len) {
      return
    }

    var bit_len_mask = leftShift(1, bit_len)-1

    var out_width = Math.floor((bit_len+7)/8) + byte_pad

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
      // getting negative values here, could be the bitwise ops on 32 bits only in js
      acc_bits += 8

      if (acc_bits >= bit_len) {
        acc_bits -= bit_len
        for (var x = byte_pad; x < out_width; x++) {
          out[j+x] = (Math.floor(rightShift(acc_value, (acc_bits+(8*(out_width-x-1)))))) & ((Math.floor(rightShift(bit_len_mask, (8*(out_width-x-1))))) & 0xFF)
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
