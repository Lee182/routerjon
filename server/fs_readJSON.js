const fs = require('fs')
const path = require('path')
module.exports = function fs_readJSON(filepath){
  return new Promise(function(resolve, reject){
  var p = path.resolve(filepath)

  fs.readFile(p, 'utf8', function(err, buf){
    if (err) {return reject({err, file_read_err: true})}
    try {
      resolve(JSON.parse(buf.toString()) )
    } catch (e) {
      return reject({err, file_not_json: true})
    }
  })

  })
}
