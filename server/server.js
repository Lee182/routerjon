/* eslint-disable */
const le_store_certbot = require('le-store-certbot')
const Greenlock = require('greenlock-express');
const redirect_https = require('redirect-https')
const express = require('express')
const util = require('util')
const servers = {
  http: require('http'),
  https: require('https'),
  spdy: require('http2'),
  prox: require('http-proxy')
}

var chal1 =  le_challenge_fs.create({
  webrootPath: '~/letsencrypt/var/acme-challenges'})

module.exports = function server(config) {
  var o = {
    http: null,
    https: null,
    config
  }
  function init() {
    function approveDomains(opts, certs, cb) {
      // TODO - verify domain
      console.log('opts.....')
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
      debug: o.config.debug
    })

    const greenlock = Greenlock.create({
      server: o.config.production ? 'https://acme-v02.api.letsencrypt.org/directory': 'https://acme-staging-v02.api.letsencrypt.org/directory',
      version: 'draft-11',
      challenges: {
        'draft-11': chal1,
      },
      store: leStore,
      approveDomains
    })

    const app = express();
    app.use(function (req, res) {
      var a = o.config.router[req.headers.host]
      if (o.config.debug) {console.log('https', req.headers.host)}
      if  (!a) {
        req.destroy()
        return
      }
      if (!isNaN(a) || (!a.http && !isNaN(a.port) && !a.redirect) ) {
        proxy.web(req, res, {target: 'http://localhost:'+a})
        return
      }
      if (a.redirect === true) {
        res.redirect(a.redirectUrl)
        return
      }
      if (a.http === true) {
        res.redirect(`http://${req.headers.host}${req.url}`)
        return
      }
      res.end()
    });

    var proxy = servers.prox.createProxyServer({ws: true})
    proxy.on('error', function(e){
      console.log(e.Error)
    })

    // handles acme-challenge and redirects to https
    const redir = greenlock.middleware(redirect_https({ port: o.config.ports.https }))
    o.http = servers['http'].createServer(function (req, res) {
      const a = o.config.router[req.headers.host]
      if (o.config.debug) {console.log('http', req.headers.host)}
      if  (!a) {
        req.destroy()
        return
      }
      if (!isNaN(a) || (!a.http && !isNaN(a.port) && !a.redirect) ) {
        redir.apply(this, arguments)
        return
      }
      if (a.http === true) {
        proxy.web(req, res, {target: 'http://localhost:'+a.port})
        return
      }
      if (a.redirect) {
        res.writeHead(302, {'Location':  a.redirectUrl + req.url});
        res.end()
        return
      }
      req.destroy()
    })
    o.http.on('upgrade', function(req, socket, head) {
      if (o.config.debug) {console.log('http upgrade', req.headers.host)}
      var a = o.config.router[req.headers.host]
      if (typeof a === 'object' && a.http) {
        proxy.ws(req, socket, {target: 'http://localhost:'+a})
        return
      }
      req.destroy()
      return
    })
    
    o.https = servers[o.config.spdy ? 'spdy' : 'https'].createServer(greenlock.httpsOptions, greenlock.middleware(app))
    o.https.on('upgrade', function(req, socket, head) {
      var a = o.config.router[req.headers.host]
      if (o.config.debug) {console.log('https upgrade', req.headers.host)}
      if (a !== undefined) {
        proxy.ws(req, socket, {target: 'http://localhost:'+a})
      }
    })
    
    o.http.listen(o.config.ports.http)
    o.https.listen(o.config.ports.https, function() {
      console.log("letsencypt listening at", this.address())
    })
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
