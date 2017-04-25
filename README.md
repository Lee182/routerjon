# routerjon

## install
```bash
npm install -g routerjon
```

## config defaults
```json
{
  "http-port": 3000,
  "https-port": 3443,
  "acme-server": "staging"
}
```

## run
```bash
routerjon /path2config.json
```
you may need sudo root privallages to run the command with the server ports 80 and 443, and also stop your apache or nginx server.

this script will store your certificates in the default letsencrypt folder.
