/* eslint-disable */
const cjson = require('cjson')
const GreenlockExpress = require('greenlock-express')
const Greenlock = require('greenlock')
const awaity = require('awaity')

const util = require('util')
const path = require('path')

const pkg = cjson.load(path.resolve(__dirname, 'package.json'))
console.log(pkg.name, pkg.version)
const servers = {
  http: require('http'),
  https: require('https'),
  spdy: require('http2'),
  prox: require('http-proxy')
}

module.exports = function server(config) {
  const o = {
    http: null,
    https: null,
    config
  }
  async function init() {
    const greenlock = Greenlock.create({
      staging: o.config.production === false,
      debug: true,
      packageAgent: pkg.name + '/' + pkg.version,
      packageRoot: __dirname,
      maintainerEmail: o.config.email,
      agreeToTerms: true,
      notify: async function (ev, args) {
        const bError = ev === 'error'
        const bWarning = ev === 'warning'
        const log = bError || bWarning ? console.error : console.info
        log(ev, args)
        try {
          const bNotFound = bError && args.code === 'ENOTFOUND'
          const bIpError = bError && args.code === 'E_ACME'
          if (bNotFound) {
            console.log('NOT FOUND', args.subject)
          }
          if (bIpError) {
            console.log('IP ERROR', args.subject)
          } else {
            console.log(args)
          }
        } catch (err) {
          console.error(err)
        }
      }
    })

    const getConfig = () => {
      return {
        greenlock,
        cluster: false,
        find(options) {
          const servername = options.servername // www.example.com
          const wildname = options.wildname // *.example.com
          console.log(servername)
          if (!o.config.router[servername]) {
            return Promise.reject()
          }
          return Promise.resolve(options)
        }
      }
    }

    const proxy = servers.prox.createProxyServer({ ws: true })

    function handleRequest(req, res, isHttp) {
      const config = o.config.router[req.headers.host]
      if (!config) {
        req.destroy()
        return
      }
      if (o.config.debug) {
        console.log(isHttp ? 'http' : 'https', req.headers.host)
      }
      const bNumber = typeof config === 'number'
      const bHttpOk = isHttp && (config.http || bNumber)
      if (bHttpOk === false) {
        return
        // res.writeHead(301, { Location: 'https://' + req.headers.host + req.path })
        // res.end()
      }
      if (config.redirectUrl) {
        res.writeHead(302, { Location: config.redirectUrl + req.url })
        res.end()
        return
      }
      const port = bNumber ? config : config.port
      proxy.web(req, res, { target: 'http://localhost:' + port })
    }

    function httpsWorker(glx) {
      proxy.on('error', function (e) {
        debugger
        console.log('proxy error', e.Error)
      })

      o.http = glx.httpServer(function (req, res) {
        handleRequest(req, res, true)
      })
      o.http.on('upgrade', function (req, socket, head) {
        if (o.config.debug) {
          console.log('http upgrade', req.headers.host)
        }
        const config = o.config.router[req.headers.host]
        if (typeof a === 'object' && a.http) {
          proxy.ws(req, socket, {
            target: 'http://localhost:' + config.port
          })
          return
        }
        req.destroy()
        return
      })

      o.https = glx.httpsServer(null, (req, res) => {
        handleRequest(req, res, false)
      })
      o.https.on('upgrade', function (req, socket, head) {
        const config = o.config.router[req.headers.host]
        if (o.config.debug) {
          console.log('https upgrade', req.headers.host)
        }
        if (config !== undefined) {
          proxy.ws(req, socket, { target: 'http://localhost:' + config })
        }
      })

      o.http.listen(o.config.ports.http)
      o.https.listen(o.config.ports.https, function () {
        console.log('letsencypt e at', this.address())
      })
    }

    try {
      await greenlock.manager.defaults({
        subscriberEmail: o.config.email,
        agreeToTerms: true
      })

      let aSites = Object.keys(o.config.router).filter((sSite) => {
        const site = o.config.router[sSite]
        return site.httpOnly !== true
      })
      console.log('aSites:', aSites)
      await awaity.each(aSites, async (sSite) => {
        return greenlock.sites.add({
          subject: sSite,
          altnames: [sSite]
        })
      })

      const gl0 = GreenlockExpress.init(getConfig)
      const gl1 = gl0.serve(httpsWorker)
    } catch (err) {
      debugger
      console.error(err)
    }
  }

  function update(config) {
    o.config = config
  }

  function destroy() {
    try {
      return Promise.all([util.promisify(o.http.close)(), util.promisify(o.https.close)()])
    } catch (err) {
      return
    }
  }

  o.init = init
  o.destroy = destroy
  o.update = update
  return o
}
