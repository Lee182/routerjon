const http = require('http')

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html')
  res.setHeader('X-Foo', 'bar')
  res.writeHead(200, {'Content-Type': 'text/plain'})
  res.end('ok')
})

server.listen(9000, function(){
  console.log('test server started at port:9000')
  // any port not the same as config.ports
})
