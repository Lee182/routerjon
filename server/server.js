/* eslint-disable */
const pkg = require('../package.json')
const le_store_certbot = require('le-store-certbot')
const GreenlockExpress = require('greenlock-express')
const redirect_https = require('redirect-https')
const express = require('express')
const util = require('util')
const os = require('os')
const path = require('path')
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
		const getConfig = () => {
			return {
				packageAgent: `${pkg.name}/${pkg.version}`,
				maintainerEmail: o.config.email,
				packageRoot: __dirname,
				find(options) {
					const servername = options.servername // www.example.com
					const wildname = options.wildname // *.example.com
					console.log(wildname)
					if (!o.config.router[wildname]) {
						return Promise.reject()
					}
					return Promise.reject()
					return {
						subject: servername,
						altnames
					}
				}
			}
		}

		function handleRequest(req, res) {
			const config = o.config.router[req.headers.host]
			if (o.config.debug) {
				console.log('https', req.headers.host)
			}
			if (!config) {
				req.destroy()
				return
			}
			const bNumber = typeof a === 'number'
			const port = bNumber ? config : config.port
			if (bNumber || (!config.http && !isNaN(config.port) && !config.redirect)) {
				proxy.web(req, res, { target: 'http://localhost:' + port })
				return
			}
			if (config.redirect === true) {
				res.redirect(config.redirectUrl)
				return
			}
			if (config.http === true) {
				res.writeHead(302, { Location: config.redirectUrl + req.url })
				res.end()
				return
			}
			res.destroy()
		}

		function httpsWorker(glx) {
			const proxy = servers.prox.createProxyServer({ ws: true })
			proxy.on('error', function(e) {
				console.log('proxy error', e.Error)
			})

			// handles acme-challenge and redirects to https
			// const redir = redirect_https({ port: o.config.ports.https })
			o.http = glx.httpServer()
			o.http.on('upgrade', function(req, socket, head) {
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

			o.https = glx.httpsServer(null, handleRequest)
			o.https.on('upgrade', function(req, socket, head) {
				const config = o.config.router[req.headers.host]
				if (o.config.debug) {
					console.log('https upgrade', req.headers.host)
				}
				if (config !== undefined) {
					proxy.ws(req, socket, { target: 'http://localhost:' + config })
				}
			})

			o.http.listen(o.config.ports.http)
			o.https.listen(o.config.ports.https, function() {
				console.log('letsencypt listening at', this.address())
			})
		}

		GreenlockExpress.init(getConfig).serve(httpsWorker)
	}

	function update(config) {
		o.config = config
	}

	function destroy() {
		try {
			return Promise.all([ util.promisify(o.http.close)(), util.promisify(o.https.close)() ])
		} catch (err) {
			return
		}
	}

	o.init = init
	o.destroy = destroy
	o.update = update
	return o
}
