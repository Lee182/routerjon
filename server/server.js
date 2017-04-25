const le_store_certbot = require('le-store-certbot')
const le_challenge_fs = require('le-challenge-fs')
const greenlock_express = require('greenlock-express')
const redirect_https = require('redirect-https')
const servers = {
  http: require('http'),
  https: require('https'),
  spdy: require('spdy'),
  prox: require('http-proxy')
}

module.exports = function server(config) {
  var o = {
    http: null,
    https: null
  }
  function init() {
    function approveDomains(opts, certs, cb) {
      // TODO - verify domain
      if (certs) {
        opts.domains = config.domains
      }
      else {
         opts.email = config.email
         opts.agreeTos = true
      }
      console.log('approveDomains', opts, certs)
      cb(null, { options: opts, certs: certs })
    }

    var leStore = le_store_certbot.create({
      configDir: '~/letsencrypt/etc',
      privkeyPath: ':configDir/live/:hostname/privkey.pem',
      fullchainPath: ':configDir/live/:hostname/fullchain.pem',
      certPath: ':configDir/live/:hostname/cert.pem',
      chainPath: ':configDir/live/:hostname/chain.pem',
      workDir: '~/letsencrypt/var/lib',
      logsDir: '~/letsencrypt/var/log',
      webrootPath: '~/letsencrypt/srv/www/:hostname/.well-known/acme-challenge',
      debug: false
    })
    var chal1 =  le_challenge_fs.create({
      webrootPath: '~/letsencrypt/var/acme-challenges'})

    var lex = greenlock_express.create({
      server: config.production ? 'https://acme-v01.api.letsencrypt.org/directory': 'staging',
      challenges: {
        'http-01': chal1,
      },
      store: leStore,
      approveDomains: approveDomains
    })

    // handles acme-challenge and redirects to https
    o.http = servers['http'].createServer()
    o.http.on('request',
      lex.middleware( redirect_https({port: config.ports.https}) )
    )
    o.http.listen(config.ports.http)


    var proxy = servers.prox.createProxyServer({ws: true})
    proxy.on('error', function(e){
      console.log(e.Error)
    })


    o.https = servers[config.spdy ? 'spdy' : 'https'].createServer(lex.httpsOptions,
    lex.middleware(function (req, res) {
      var a = config.router[req.headers.host]
      if (a !== undefined) {
        return proxy.web(req, res, {target: 'http://localhost:'+a})
      }
      res.end()
    }))

    o.https.on('upgrade', function(req, socket, head) {
      var a = config.router[req.headers.host]
      if (a !== undefined) {
        proxy.ws(req, socket, {target: 'http://localhost:'+a})
      }
    })

    o.https.listen(config.ports.https, function() {
      // console.log("Listening for ACME tls-sni-01 challenges and serve app on", this.address())
      console.log("letsencypt listening at", this.address())
    })
  }

  function destroy() {
    o.http.close()
    o.https.close()
  }

  o.init = init
  o.destroy = destroy
  return o
}