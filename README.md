# dependency-hunter

Find node.js dependencies in github repositories.

## Installation

`npm install dependency-hunter -g`

The first time you run it, the application will ask for github user/pass. Supports two-factor authentication if you have it.

## Usage

Before running it, you should update the data from your organization:

`dependency-hunter myorgnization update`

After it has run you can now search for modules. To find out which repositories uses the `request` module do this:

`dependency-hunter myorganization find request`

## License

MIT