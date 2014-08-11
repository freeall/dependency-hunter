# dependency-hunter

Find node.js dependencies in github repositories.

## Installation

`npm install dependency-hunter -g`

Then create a `.dependency-hunter.json` in your home folder and fill it with something like this:

```
{
 	"user": "mygithubuser",
 	"pass": "mygithubpass"
}
```

## Usage

Before running it, you should update the data from your organization

`dependency-hunter myorgnization update`

After it has run you can now search for modules. To find out which repositories uses the `request` module do this:

`dependency-hunter myorganization find request`

## License

MIT