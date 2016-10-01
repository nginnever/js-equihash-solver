'use strict'

const blake2 = require('blake2')
const convert = require('./convert')

var inp = new ArrayBuffer(8)
console.log(inp.byteLength)
console.log('-----')
var test = convert.expand_array(inp, 9, 14, 0)
var test2 = convert.compress_array(inp, 9, 14, 0)
console.log('------')
console.log(test.byteLength)

for (var t in test) {
  console.log(test[t])
}

console.log('-------')

for (var t in test2) {
  console.log(test2[t])
}

function hash_nonce(digest, nonce) {
  for (var i = 0; i < 8; i++) {

  }
}

function gbp_basic(digest, n, k) {
  var collision_len = n/(k+1)
  var hash_length = (k+1)*(Math.floor((collision_len+7)/8))
  var indices_per_hash_output = 512/n

  console.log(hash_length)
}

gbp_basic(null, 200, 9)
// for (var i = 0; i < test.byteLength; i++) {
//   console.log(test[i])
// }