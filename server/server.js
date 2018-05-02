/* eslint-disable */
const le_store_certbot = require('le-store-certbot')
const le_challenge_fs = require('le-challenge-fs')
const greenlock_express = require('greenlock-express')
const redirect_https = require('redirect-https')
const express = require('express')
const util = require('util')
const servers = {
  http: require('http'),
  https: require('https'),
  spdy: require('http2'),
  prox: require('http-proxy')
}

module.exports = function server(config) {
  var o = {
    http: null,
    https: null,
    config
  }
  function init() {
    function approveDomains(opts, certs, cb) {
      // TODO - verify domain
      if (!o.config.router[opts.domain]) {
        cb(true)
        return
      }
      if (certs) {
        opts.domains = o.config.domains
      } else {
        opts.email = o.config.email
        opts.agreeTos = true
      }
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
      server: o.config.production ? 'https://acme-v02.api.letsencrypt.org/directory': 'https://acme-staging-v02.api.letsencrypt.org/directory',
      version: 'draft-11',
      challenges: {
        'draft-11': chal1,
      },
      store: leStore,
      approveDomains: approveDomains
    })

    const app = express();
    app.use(function (req, res) {
      var a = o.config.router[req.headers.host]
      if (a !== undefined) {
        proxy.web(req, res, {target: 'http://localhost:'+a})
        return
      }
      res.end()
    });

    var proxy = servers.prox.createProxyServer({ws: true})
    proxy.on('error', function(e){
      console.log(e.Error)
    })

    if (o.config.ports.https) {
      // handles acme-challenge and redirects to https
      o.http = servers['http'].createServer()
      o.http.on('request',
        lex.middleware( redirect_https({port: o.config.ports.https}) )
      )
      o.http.listen(o.config.ports.http)

      o.https = servers[o.config.spdy ? 'spdy' : 'https'].createServer(lex.httpsOptions, lex.middleware(app))
      o.https.on('upgrade', function(req, socket, head) {
        var a = o.config.router[req.headers.host]
        if (a !== undefined) {
          proxy.ws(req, socket, {target: 'http://localhost:'+a})
        }
      })
  
      o.https.listen(o.config.ports.https, function() {
        console.log("letsencypt listening at", this.address())
      })
    } else {
      o.http = servers['http'].createServer(app)
      o.http.on('upgrade', function(req, socket, head) {
        var a = o.config.router[req.headers.host]
        if (a !== undefined) {
          proxy.ws(req, socket, {target: 'http://localhost:'+a})
        }
      })
      o.http.listen(o.config.ports.http, function(){
        console.log('http only oh dear')
      })
    }


  }

  function update(config) {
    o.config = config
  }

  function destroy() {
    try {
      return Promise.all([
        util.promisify(o.http.close)(),
        util.promisify(o.https.close)()
      ])
    } catch (err) {
      return
    }
  }

  o.init = init
  o.destroy = destroy
  o.update = update
  return o
}
