# routerjon
an nodejs expressjs router, giving you outward https encryption with certificates issued from letsencrypt.

basically my script i use for https certs on deployment.

## install
```bash
npm install -g routerjon
```

## setup
```bash
mkdir routerjon
cd routerjon
touch config.json
```
config json should list the different domains you will use. and to which routerjon should redirect them.

for example the config running on my deployment at blogjono.com is
```js
{
  "ports": {
    "http": 80,
    "https": 443
  },
  "production": true, // server for letsencrypt, note production has rate limit
  "domains": [
    "blogjono.com", "*.blogjono.com",
    "opentorah.uk", "*.opentorah.uk"
  ],
  "email": "jono-lee@hotmail.co.uk",
  "router": { // these are servers already running on the machine
    "blogjono.com": {
      ".": 9000,
      "fcc-pin": 9001,
      "booktrade": 9003
    },
    "opentorah.uk": 9002
  }
}
```
### default config
The default config fills in any gaps missed by your config.
```js
{
  "ports": {
    "http": 3000,
    "https": 3443
  },
  "production": false,
  "spdy": false, // option to use an experimental http2 server
  "domains": {
    "localhost:3000": 9000
  }
}
```


## run
```bash
[sudo] routerjon ./conifg.json
```
## run (in background)
```bash
nohup routerjon ./config.json
```
## run forever
make sure you are in a directory with a file named exactly ```config.json```

when routerjon crashes it will foreverjs process manager will restart it

```
[sudo] npm i -g forever
touch routerjon_forever
```
routerjon_forever file
```
#!/bin/sh
routerjon ./config.json
```
```
[sudo] forever start -c bash routerjon-forever
```
you may need sudo or root privallages to run the command with the server ports 80 and 443. you will also need to stop any other servers (like nginx, apache) listening on these ports

## reload changes
by default when you edit the config with valid json and save the file, changes will be automatically reloaded (thanks to node-watch). This makes it easy to vim into and fiddle with the routers port numbers

## details
the script will store your certificates in the ```~/letsencrypt``` directory.

i am not sure the ```greenlock-express``` module causes them to autorenew.

## author & licence
author: **[Jonathan T L Lee](https://github.com/Lee182)**

licence: MIT

repo: [https://github.com/Lee182/routerjon]( https://github.com/Lee182/routerjon)

feel free look around the code. its only 176 lines
