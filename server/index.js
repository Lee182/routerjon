#!/usr/bin/env node

// code for https taken from greenlock-express
const fs_readJSON = require('./fs_readJSON.js')
const _ = require('lodash')
const watch = require('node-watch')
const Server = require('../index.js')

var server = null

// if (process.argv.length === 2) {
//   console.log('please specify config file as first argument like')
//   console.log('$ routerjon ./config.json')
// }
const config_path = process.argv[process.argv.length - 1] || './config.json'
const config_update = async (config, defaultConfig) => {
  let conf = _.merge(defaultConfig, config)
  let http_port_change, https_port_change, letencrypt_server_change, domains_change
  if (server && server.config) {
    http_port_change = conf.ports && conf.ports.http !== server.config.ports.http
    https_port_change = conf.ports && conf.ports.https !== server.config.ports.https
    letencrypt_server_change = server.config.production !== conf.production
    domains_change = !_.isEqual(server.config.domains, conf.domains)
  }
  conf = parseConfigTreeToFlat(conf)

  const change_should_restart_server = http_port_change || https_port_change || letencrypt_server_change

  if (change_should_restart_server && server !== null) {
    await server.destroy()
  }
  if (server) {
    server.update(conf)
  }
  if (change_should_restart_server || server === null) {
    server = Server(conf)
    server.init()
  }
}

// read config and apply defaults.
// config_update causes server to start
const main = async () => {
  const [configDefault, config] = await Promise.all([
    fs_readJSON(__dirname + '/default_config.json'),
    fs_readJSON(config_path)
  ])
  await config_update(config, configDefault)
}

watch(config_path, async (evt, name) => {
  if (evt === 'update') {
    await main()
  }
})

process.on('exit', () => {
  if (!server) {
    return
  }
  server.destroy()
})

process.on('unhandledRejection', (reason, p) => {
  console.log(reason, p)
})

const parseConfigTreeToFlat = function (config) {
  const oRouter = {}
  const mapObject = (sParent, value, sKey) => {
    const bValid = isValidDomainConfig(value)
    const sFulldomain = sKey === '.' ? sParent : `${sKey}${sParent}`
    if (!bValid) {
      _.reduce(value, mapObject, sFulldomain)
    }
    if (bValid) {
      oRouter[sFulldomain] = value
    }
    return sParent
  }
  const isValidDomainConfig = (config) => {
    if (typeof config === 'number') {
      const bIsPort = true
      return bIsPort
    }
    if (typeof config === 'object') {
      const bPort = config.port === Number(config.port)
      const bRedirect = config.redirectUrl
      return bPort || bRedirect
    }
    return false
  }
  _.reduce(config.router, mapObject, '')
  config.router = oRouter
  return config
}

main()
