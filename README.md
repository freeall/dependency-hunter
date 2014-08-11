# dependency-hunter

Find node.js dependencies in github repositories.

## Installation and usage

```
# First create config.json with data like
# {
#   "user": "mygithubuser",
#   "pass": "mygithubpass"
# }

# Then update the organization data
dependency-hunter myorganization update

# Now you can find dependencies
dependency-hunter myorganization find request # find all your repos using the request module
```

