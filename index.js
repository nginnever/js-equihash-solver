'use strict'

const blake2 = require('blake2')
const ba = require('binascii')
const bufferpack = require('bufferpack')
const struct = require('python-struct')
const convert = require('./convert')
const sodium = require('libsodium-wrappers')
const xor = require('bitwise-xor')

var concant = []

// var inp = new ArrayBuffer(8)
// console.log(inp.byteLength)
// console.log('-----')
// var test = convert.expand_array(inp, 9, 14, 0)
// var test2 = convert.compress_array(inp, 9, 14, 0)
// console.log('------')
// console.log(test.byteLength)

// for (var t in test) {
//   console.log(test[t])
// }

// console.log('-------')

// for (var t in test2) {
//   console.log(test2[t])
// }

// Javascript left shift operator only works on 32 bit numbers
function leftShift(number, shift) {
  return number * Math.pow(2, shift)
}

function rightShift(number, shift) {
 return number / Math.pow(2, shift)
}

function hash_nonce (digest, nonce) {
  for (var i = 0; i < 8; i++) {
    digest.update(struct.pack('<i', nonce))
  }
}

function hash_xi (digest, xi) {
  digest.update(struct.pack('<i', xi))
  return digest // For chaining
}

function has_collision (ha, hb, i, l) {
  var res = true

  //ha = ha.toString('hex')
  //hb = hb.toString('hex')
  //console.log('comparing...')
  //console.log(ha.toString('hex'))
  //console.log(hb.toString('hex'))
  //console.log(i)
  //console.log(i*l/8)

  for (var j = (i-1)*l/8; j < i*l/8; j++) {
    if (ha[j] !== hb[j]) {

      //console.log(ha[j] + ' : ' + hb[j])
      res = false
    }
  }
  
  return res
  //res = [ha[j] == hb[j] for j in range((i-1)*l/8, i*l/8)]
  //return reduce(lambda x, y: x and y, res)
}

function distinct_indices (a, b){
  //console.log(a[0] + ' : ' + b[0])
  var re 
  for (var i = 0; i<a.length; i++) {
    if (a[i] === b[i]) {
      return false
    } else {
      re = true
    }
    return re
  }
}

var hexer = function(a, b) {
  var ax = parseInt(a,16)
  if (isNaN(ax)) throw "First value is not a hexidecimal number"

  var bx = parseInt(b,16)
  if (isNaN(bx)) throw "Second value is not a hexidecimal number"

  // easiest check
  if (ax < bx) return -1
  if (ax > bx) return  1
}


function gbp_basic (digest, n, k) {
  return new Promise((resolve, reject) => {
    // Durring 1st round, look for collisiions on the 1st n/k+1 bits
    // The next round look for collision on the next n/k+1 bits and so on
    var collision_length = n/(k+1)

    var tuple_n 


    var hash_length = (k+1)*(Math.floor((collision_length+7)/8))

    var indices_per_hash_output = Math.floor(512/n)

    var X = []
    var tmp_hash = ''
    
    // generate list of hashes of size 2^(collision_len + 1) for an average of 
    // 2 solutions per sort
    // N = 131072
    console.log(Math.pow(2, collision_length+1))
    for (var i = 0; i < Math.pow(2, collision_length+1); i++) { // Math.pow(2, collision_length+1)
      var r = i%indices_per_hash_output
      //console.log('r ' + r)
      if (r === 0) {
        //X_i = H(I||V||x_i)
        var curr_digest = digest.copy()
        //console.log('test')
        curr_digest = hash_xi(curr_digest, Math.floor(i/indices_per_hash_output))
        tmp_hash = curr_digest.digest()
        //console.log(tmp_hash)
      }
      var _X = convert.expand_array(tmp_hash.slice(r*n/8, (r+1)*n/8), hash_length, collision_length)
      //console.log('X')
      var tuple = {
        hash: _X,
        index: [i]
      }

      X.push(tuple)
      //console.log(_X.toString('hex'))
    }
    //console.log(X)
    for (var _i = 1; _i < k; _i++) {
      console.log('ROUND NUMBER: ' + _i)
      console.log('SORTING LIST')
      X.sort((o1, o2) => {
        // console.log(o1.hash.length)
        // for (var i = 0; i < o1.hash.length; i++) {
        //   if (o1.hash[i] < o2.hash[i])
        // }
        var str1 = o1.hash.toString('hex')
        var str2 = o2.hash.toString('hex')
        return str1 < str2 ? -1 : 1 
      })
      console.log('DONE SORTING')
      
      // DEBUG: the scoping on i is all whack
      for (var i = 0; i < 32; i++) {
        //console.log(X[X.length - i])
        console.log(X[X.length -1 -i].hash.toString('hex') + ' ( ' +X[X.length -1 -i].index+',)' )
      }

      console.log('FINDING COLLISIONS')
      var Xc = []

      while (X.length > 0) {
        var j = 1
        while (j < X.length) {//X.length) {
          //console.log('------')
          if (!has_collision(X[X.length - 1].hash, X[(X.length - 1) - j].hash, _i, collision_length)){
            
            //console.log('no collision')
            //console.log(X[X.length - 1].hash)
            //console.log(X[X.length - 1 - j].hash)
            break
          } else {
            
            j++
            //console.log('j: '+j)
            //console.log('found collision')
          }
        }
            
        for (var l = 0; l < j-1; l++) { // 0, 1, 2, 3
          //console.log('l: ' + l)
          //return
          for (var m = l+1; m < j; m++) { // [0, 1, 2, 3] - [1, 2, 3] - [2, 3] - [3] 
            //console.log('m: ' + m)
            //return
            // check that there are no duplicate indices'
            //console.log('******')
            //console.log(X[(X.length - 1) - l].index)
            //console.log(X[(X.length - 1) - l].hash)
            //console.log(X[(X.length -1) - m].index)
            //console.log(X[(X.length -1) - m].hash)
            //console.log('******')
            if (distinct_indices(X[(X.length - 1) - l].index, X[(X.length -1) - m].index)) {

              //console.log('distinct')
              // console.log('('+X[(X.length - 1) - l].index+',)')
              // console.log('('+X[(X.length - 1) - m].index+',)')
              //return
              if (X[(X.length - 1)-l].index[0] < X[(X.length - 1)-m].index[0]) {
                concant = X[(X.length - 1)-l].index.slice()
                concant.push(X[(X.length - 1)-m].index[0])
                //console.log('a < b')
                //console.log(concant)
              } else {
                concant = X[(X.length - 1)-m].index.slice()
                concant.push(X[(X.length - 1)-l].index[0])
                //console.log('a > b')
                //console.log(concant)
              }

              // INDICES ARE NOT TUPLE STORED EXACTLY RIGHT
              Xc.push({
                hash: xor(X[X.length-1-l].hash, X[X.length-1-m].hash),
                index: concant
              })
              //console.log(Xc)
              //console.log(xor(X[X.length-1-l].hash, X[X.length-1-m].hash).toString('hex'))
              //console.log(Xc[m].hash.toString('hex'))
              //return
            }
            //return
          }
        }
        //return
        while(j > 0) {
          X.pop(X.length - 1 - j)
          j -= 1
        }
        //console.log(X.length)

      }
      X = Xc
      Xc = []
      //console.log(X)
      console.log('Done with new list!')
    }
    //console.log(X)
    console.log('FOUND SOLUTIONS!')
    reolve()
  })
}

function zcash_person (n, k){
  //return b'ZcashPoW' + struct.pack('<II', n, k)
  //return bufferpack.pack('<II', n, k)
  return struct.pack('<ii', [n, k])
}

function mine (n, k, d) {
  var prev_hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  console.log(ba.unhexlify(prev_hash))
  var b = ba.unhexlify(prev_hash)
  console.log(ba.hexlify(b))
  //gbp_basic(null, n, k, d)
  console.log((512/n)*n/8)

  while (true) {
    var date = new Date();
    console.log(date)
    // H(I||...)
    var person = zcash_person(n,k)
    console.log(person.toString('hex'))
    console.log(ba.unhexlify(person.toString('hex')))
    var digest = blake2.createHash('blake2b', {digestLength: (512/n)*n/8})
    digest.update(new Buffer(ba.unhexlify(person.toString('hex'))))
    //console.log(digest.digest("hex"))
    digest.update(new Buffer(prev_hash))  
    //console.log(digest.digest("hex"))

    //var stest = sodium.crypto_generichash(64, ba.unhexlify(person.toString('hex')))
    //console.log(sodium.to_hex(stest))
    //break
    var nonce = 0
    var x

    // not sure what this is supposed to do 
    // while(rightShift(nonce, 161) === 0) {
    while (nonce < 1) {
      // H(I||V||...)
      var curr_digest = digest.copy()

      hash_nonce(curr_digest, nonce)
      // (x_1, x_2, ...) = A(I, V, n, k)
      gbp_basic(curr_digest, n, k)
        .then(() => {
          console.log('finished solving!')
        })

      nonce += 1
    }
    break
  }
}

mine(96, 5, 3)

// for (var i = 0; i < test.byteLength; i++) {
//   console.log(test[i])
// }