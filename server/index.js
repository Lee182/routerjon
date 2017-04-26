#!/usr/bin/env node

// code for https taken from greenlock-express
const fs_readJSON = require('./fs_readJSON.js')
const _ = require('lodash')
const watch = require('node-watch')
const Server = require('./server.js')

var default_config = null
var config = null
var server = null

// if (process.argv.length === 2) {
//   console.log('please specify config file as first argument like')
//   console.log('$ routerjon ./config.json')
// }
const config_path = process.argv[2] || './config.json'
const config_update = function(c) {
  c = _.merge(default_config, c)
  if (config !== null) {
    var http_port_change = c.ports && c.ports.http !== config.ports.http
    var https_port_change = c.ports && c.ports.https !== config.ports.https
    var letencrypt_server_change = config.production !== c.production
    var domains_change = !_.isEqual(config.domains, c.domains)

    var change_should_restart_server = http_port_change || https_port_change || letencrypt_server_change || domains_change

    if (change_should_restart_server && server !== null) {
      server.destroy()
    }
  }
  config = c
  server = Server(config)
  server.init()
}


// read config and apply defaults.
// config_update causes server to start
Promise.all([
  fs_readJSON(__dirname+'/default_config.json'),
  fs_readJSON(config_path)
])
.then(function([a,b]){
  default_config = a
  return b
})
.then(config_update)
.then(function(){

})
.catch(function(err){
  console.log(err)
  process.exit()
})


watch(config_path, function(evt, name){
  if (evt !== 'update') {return}
  fs_readJSON(config_path).then(config_update)
})
