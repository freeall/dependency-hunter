# dependency-hunter

Find node.js dependencies in github repositories. Goes through `package.json` in each repository so you can easily find dependencies and devDependencies in each repository.

Works both for users and organizations.

If I wanted to find out how many of my own repositories that uses `request` I would run

```
$ depency-hunter freeall find request
```

Which would return

```
tvcom is using request, version: ~2.21.0
node-loggly is using request, version: 2.27.x
node-httpcheck is using request, version: ~2.16.6
mtgtop8 is using request, version: ^2.39.0
mtgjson is using request, version: ^2.36.0
Found 5 dependencies

progress-stream is using request, version: ~2.29.0
http-monitor is using request, version: ~2.33.0
Found 2 devDependencies

Data for freeall was last updated: 2014-08-12T14:01:57.694Z
```

## Installation

`npm install dependency-hunter -g`

The first time you run it, the application will ask for github user/pass. Supports two-factor authentication if you have it.

## Usage

Before running it, you should update the data from your user/organization

`dependency-hunter myuser update`

After it has run you can now search for modules. To find out which repositories uses the `request` module do this:

`dependency-hunter myuser find request`

## License

MIT