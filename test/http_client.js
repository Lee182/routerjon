const request = require('request')

console.log('test: http://localhost:3000')
request('http://localhost:3000', function(err, response, body){
  does_redirect_to_https = body.match('^<html>\n<head>\n  <META http-equiv="refresh" content="0;URL=\'https://localhost:3443/\'">\n</head>')!==null
  console.log('test: does_redirect_to_https:', does_redirect_to_https)
  console.log(err)
})

console.log('test: https://localhost:3443')
request('https://localhost:3443', function(err, response, body){
  console.log('https',response)
})
