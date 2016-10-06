'use strict'

const blake2 = require('blake2')
const ba = require('binascii')
const bufferpack = require('bufferpack')
const struct = require('python-struct')
const convert = require('./convert')
const sodium = require('libsodium-wrappers')
const xor = require('bitwise-xor')

// temporary array for holding the tuples of colliding hash indices
var concat = []

var start
var stop

// Javascript left shift operator only works on 32 bit numbers
function leftShift(number, shift) {
  return number * Math.pow(2, shift)
}

function rightShift(number, shift) {
 return number / Math.pow(2, shift)
}

// update the blake2b hash with a nonce after every solution
// is found
function hash_nonce (digest, nonce) {
  for (var i = 0; i < 8; i++) {
    digest.update(struct.pack('<i', nonce))
  }
}

function hash_xi (digest, xi) {
  digest.update(struct.pack('<i', xi))
  return digest // For chaining
}

// helper function to check if a collision is found on the
// first n/k+1 bits of each for each k round
function has_collision (ha, hb, i, l) {
  var res = true

  // TODO: Not exactly sure how these params translate into
  // shifting over n/k+1 bits for each k round
  for (var j = (i-1)*l/8; j < i*l/8; j++) {
    if (ha[j] !== hb[j]) {
      res = false
    }
  }
  
  return res
}

function count_zeroes (h) {
  // convert to hex string, then to bin string
  var tester = hexToBinary(h.toString('hex'))

  // count leading zeroes
  var counter = 0
  for (var i = 0; i < tester.result.length; i++) {
    if (tester.result[i] === '0') {
      counter++
    } else {
      //console.log(counter)
      return counter
    }
  }
}

function hexToBinary(s) {
    var i, k, part, ret = ''
    // lookup table for easier conversion. '0' characters are padded for '1' to '7'
    var lookupTable = {
        '0': '0000', '1': '0001', '2': '0010', '3': '0011', '4': '0100',
        '5': '0101', '6': '0110', '7': '0111', '8': '1000', '9': '1001',
        'a': '1010', 'b': '1011', 'c': '1100', 'd': '1101',
        'e': '1110', 'f': '1111',
        'A': '1010', 'B': '1011', 'C': '1100', 'D': '1101',
        'E': '1110', 'F': '1111'
    }
    for (i = 0; i < s.length; i += 1) {
        if (lookupTable.hasOwnProperty(s[i])) {
            ret += lookupTable[s[i]]
        } else {
            return { valid: false }
        }
    }
    return { valid: true, result: ret }
}

// helper function to check the indices of colliding hashes
// when the list is regenerated, there is chance that
// the same collision will be compared, so we check the
// indices to be sure they are different before including
// that collision in the next list for the next k round
function distinct_indices (a, b){
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

function gbp_basic (digest, n, k) {
  return new Promise((resolve, reject) => {
    // Durring 1st round, look for collisiions on the 1st n/k+1 bits
    // The next round look for collision on the next n/k+1 bits and so on
    var collision_length = n/(k+1)

    // this is the length in bits of the hash for the list
    // n = 200
    // TODO: not sure how this is calculated
    var hash_length = (k+1)*(Math.floor((collision_length+7)/8))

    // TODO: No idea how this is calculated
    var indices_per_hash_output = Math.floor(512/n)

    var L = []
    var tmp_hash = ''
    
    // generate list of hashes of size 2^(collision_len + 1) for an average of 
    // 2 solutions per sort
    // N = 131072 with k=5 n=96
    // loop N = 131072 times with 2^n/k+1
    for (var i = 0; i < Math.pow(2, collision_length+1); i++) { // Math.pow(2, collision_length+1)
      var r = i%indices_per_hash_output

      // each list with have different index output length
      if (r === 0) {
        // generate the hashes by
        // L_i = H(I||V||x_i...
        var curr_digest = digest.copy()

        curr_digest = hash_xi(curr_digest, Math.floor(i/indices_per_hash_output))
        tmp_hash = curr_digest.digest()
      }
      // TODO:
      // expand the hash to match n = 96 for the test case here
      // first slice then pad to get the desired 12 bytes from n
      var _L = convert.expand_array(tmp_hash.slice(r*n/8, (r+1)*n/8), hash_length, collision_length)

      // create tuples (hash, index)
      var tuple = {
        hash: _L,
        index: [i]
      }
      // add new tuple to the list L
      L.push(tuple)
    }

    // For each k round, 
    // 1. sort the list 
    // 2. then look for collisions
    // good place to combine and optimize
    for (var _i = 1; _i < k; _i++) {
      console.log('ROUND NUMBER: ' + _i)
      console.log('SORTING LIST')
      L.sort((o1, o2) => {
        var str1 = o1.hash.toString('hex')
        var str2 = o2.hash.toString('hex')
        return str1 < str2 ? -1 : 1 
      })
      console.log('DONE SORTING')
      
      // TODO: the scoping on i is all whack
      // this just prints the last 32 hashes in L
      for (var i = 0; i < 32; i++) {
        console.log(L[L.length -1 -i].hash.toString('hex') + ' ( ' +L[L.length -1 -i].index+',)' )
      }

      console.log('FINDING COLLISIONS')
      // Temporary list to hold round 2 list of collisions in r1
      var Lc = []

      // Elements from the first list L will be removed as
      // they populate the new list Lc
      while (L.length > 0) {
        var j = 1
        while (j < L.length) {
          // don't increment j if no collision, skip until a collision is found
          if (!has_collision(L[L.length - 1].hash, L[(L.length - 1) - j].hash, _i, collision_length)){
            break
          } else {
            
            j++
          }
        }
        

        for (var l = 0; l < j-1; l++) { // 0, 1, 2, 3...
          for (var m = l+1; m < j; m++) { // [0, 1, 2, 3] - [1, 2, 3] - [2, 3] - [3]...
            // check that there are no duplicate indices'
            if (distinct_indices(L[(L.length - 1) - l].index, L[(L.length -1) - m].index)) {
              // order the index
              if (L[(L.length - 1)-l].index[0] < L[(L.length - 1)-m].index[0]) {
                concat = L[(L.length - 1)-l].index.slice()
                concat.push(L[(L.length - 1)-m].index[0])
              } else {
                concat = L[(L.length - 1)-m].index.slice()
                concat.push(L[(L.length - 1)-l].index[0])
              }

              // INDICES ARE NOT TUPLE STORED EXACTLY RIGHT
              // push collision tuples to new list Lc
              Lc.push({
                hash: xor(L[L.length-1-l].hash, L[L.length-1-m].hash),
                index: concat
              })
            }
          }
        }
        // reduce L, drop the set that way just examined
        while(j > 0) {
          L.pop(L.length - 1 - j)
          j -= 1
        }
      }
      // set L to the new round 1 collision list
      L = Lc
      // clear the temp list
      Lc = []
      console.log('Done with new list!')
    }
    // k+1) Find a collision on last 2n(k+1) bits
    console.log('final round...')
    console.log('sorting list')

    L.sort((o1, o2) => {
      var str1 = o1.hash.toString('hex')
      var str2 = o2.hash.toString('hex')
      return str1 < str2 ? -1 : 1 
    })
    //console.log(L)
    console.log('finding solutions')
    var solns = []

    while (L.length > 0) {
      var j = 1
      while (j < L.length) {
        if (!has_collision(L[L.length - 1].hash, L[(L.length - 1) - j].hash, k, collision_length) &&
            !has_collision(L[L.length - 1].hash, L[(L.length - 1) - j].hash, k+1, collision_length)) {
          break
        } else {
          j++
        }
      }

      for (var l = 0; l < j-1; l++) { // 0, 1, 2, 3...
        for (var m = l+1; m < j; m++) { // [0, 1, 2, 3] - [1, 2, 3] - [2, 3] - [3]...
          var res = xor(L[L.length-1-l].hash, L[L.length-1-m].hash)
          if (count_zeroes(res) === n && distinct_indices(L[(L.length - 1) - l].index, L[(L.length -1) - m].index)) {
            console.log('weee found a solution!!!')
            console.log(L[L.length-1-l].hash.toString('hex'))
            console.log(L[L.length-1-m].hash.toString('hex'))
              // if (L[(L.length - 1)-l].index[0] < L[(L.length - 1)-m].index[0]) {
              //   concat = L[(L.length - 1)-l].index.slice()
              //   solns.push(L[(L.length - 1)-m].index[0])
              // } else {
              //   concat = L[(L.length - 1)-m].index.slice()
              //   solns.push(L[(L.length - 1)-l].index[0])
              // }
          }
        }
      }
      while(j > 0) {
        L.pop(L.length - 1 - j)
        j -= 1
      }
      resolve()
    }
  })
}

function zcash_person (n, k){
  return struct.pack('<ii', [n, k])
}

function mine (n, k, d) {
  var prev_hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

  var b = ba.unhexlify(prev_hash)

  while (true) {
    start = new Date().getTime()
    console.log(new Date())
    // H(I||...)
    var person = zcash_person(n,k)
    var digest = blake2.createHash('blake2b', {digestLength: (512/n)*n/8})
    digest.update(new Buffer(ba.unhexlify(person.toString('hex'))))

    digest.update(new Buffer(prev_hash))  

    var nonce = 0

    // not sure what this is supposed to do 
    // while(rightShift(nonce, 161) === 0) {
    while (nonce < 1) {
      // H(I||V||...)
      var curr_digest = digest.copy()

      hash_nonce(curr_digest, nonce)
      // (L_1, L_2, ...) = A(I, V, n, k)
      gbp_basic(curr_digest, n, k)
        .then(() => {
          console.log('finished solving!')
          stop = new Date().getTime()
          var t = stop - start
          t = t / 1000
          console.log('time: ' +  t + ' seconds')
        })

      nonce += 1
    }
    break
  }
}

mine(96, 5, 3)

// actual zcash params
//mine(200, 9, 3)