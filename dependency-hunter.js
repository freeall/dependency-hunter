#!/usr/bin/env node

var ghauth = require('ghauth');
var ghApi = require('github');
var log = require('single-line-log').stdout;
var fs = require('fs');
var path = require('path');
var afterAll = require('after-all');
var extend = require('xtend');

var HOME = process.env.HOME || process.env.USERPROFILE;

var github = new ghApi({
	version: '3.0.0'
});

var update = function(organization) {
	var listOfRepos = function(callback) {
		var page = 1;
		var res = [];
		var type = 'Org';

		var onend = function(err) {
			if (type === 'Org' && (!res.length || err && err.code === 404)) {
				type = 'User';
				next();
				return;
			}
			callback(null, res);
		};

		var next = function() {
			log('Getting list of repositories from '+organization+'. Page: #'+page);
			var method = type === 'Org' ? 'getForOrg' : 'getAll';
			github.repos[method]({
				org: organization,
				username: organization,
				type: 'all',
				per_page: 100,
				page: page
			}, function(err, resp) {
				if (err || !resp.data.length) return onend(err);
				res = res.concat(resp.data.filter((repo) => repo.owner.login === organization));
				page++;
				next();
			});
		};

		next();
	};

	listOfRepos(function(err, repos) {
		if (err) throw err;

		var result = {};
		var next = afterAll(function() {
			var data = {
				date: new Date(),
				repositories: result
			};

			fs.writeFile(path.join(HOME, '.dependency-hunter/'+organization+'.json'), JSON.stringify(data), function(err) {
				if (err) throw err;
				log('');
			});
		});

		var loadJson = function(file, repository, callback) {
			github.repos.getContent({
				owner: organization,
				repo: repository.name,
				path: file
			}, function(err, res) {
				// File is not there
				if (err && err.code === 404) return callback(null, {});

				var json;
				try {
					json = JSON.parse(new Buffer(res.data.content, 'base64'));
				}
				catch(e) {
					// File is not proper json
					return callback(new Error(e + 'Could not parse body for '+repository.name));
				}

				callback(null, json);
			});
		};

		repos.forEach(function(repository) {
			var onend = next();

			loadJson('/package.json', repository, function(err, npmModules) {
				if (err) console.error(err);

				loadJson('/bower.json', repository, function(err, bowerModules) {
					if (err) console.error(err);

					result[repository.name] = {
						dependencies: extend(npmModules.dependencies, bowerModules.dependencies),
						devDependencies: extend(npmModules.devDependencies, bowerModules.devDependencies)
					};

					onend();
				});
			});
		});
	});
};
var findModule = function(organization, module) {
	if (!fs.existsSync(path.join(HOME, '.dependency-hunter/'+organization+'.json'))) {
		console.log('Data doesn\'t exist for %s. Please run "%s update".', organization, organization);
		process.exit();
	}

	var depends = module[0] !== '-';
	if (!depends) module = module.substr(1);

	fs.readFile(path.join(HOME, '.dependency-hunter/'+organization+'.json'), function(err, data) {
		if (err) throw err;

		data = JSON.parse(data);

		var print = function(type) {
			var count = 0;
			Object.keys(data.repositories).sort().forEach(function(name) {
				var repo = data.repositories[name];
				var version = (repo[type] || {})[module];
				if (type === 'repositories') {
					version = (repo['dependencies'] || {})[module] || (repo['devDependencies'] || {})[module];
				}
				// Repo is NOT depending on module
				if (!depends && version === undefined) {
					count++;
					console.log('%s is not using %s', name, module);
					return;
				}
				// Repo IS depending on module
				if (depends && version !== undefined) {
					count++;
					console.log('%s is using %s, %s', name, module, version);
				}
			});

			console.log('Found %s %s', count, type);
		};

		if (!depends) {
			print('repositories');
		} else {
			print('dependencies');
			console.log('');
			print('devDependencies');
		}
		console.log('\nData for %s was last updated: %s', organization, data.date);
	});
};
var listModules = function(organization) {
	if (!fs.existsSync(path.join(HOME, '.dependency-hunter/'+organization+'.json'))) {
		console.log('Data doesn\'t exist for %s. Please run "%s update".', organization, organization);
		process.exit();
	}

	fs.readFile(path.join(HOME, '.dependency-hunter/'+organization+'.json'), function(err, data) {
		if (err) throw err;

		data = JSON.parse(data);
		Object.keys(data.repositories).forEach(function(name) {
			console.log(name);
		});
		console.log('\nThere is %s repositories', Object.keys(data.repositories).length);
		console.log('\nData for %s was last updated: %s', organization, data.date);
	});
};
var printHelp = function() {
	console.log([
		'Usage: dependency-hunter [command] [username/organization] [options?]',
		'',
		'Avaible commands are:',
		'  update                Updates the data for the username/organization',
		'  list                  Lists all modules for the username/organization',
		'  find [module]         Finds the repositories that depends on the module',
		'  find -[module]        Finds the repositories that doesn\'t depend on the module',
		'',
		'Examples:',
		'  update github         Updates the data for the organization github',
		'  list github           Lists all of githubs repositories (that is a node project)',
		'  find github express   Find the repositories that has express as a dependency/devDependency',
		'  find github -express  Find the repositories that doesn\'t use express'
	].join('\n'));
};

ghauth({
	configName: 'dependency-hunter',
	scopes: ['repo'],
	note: 'Get all repositories'
}, function(err, result) {
	if (err) throw err;

	var token = result.token;

	github.authenticate({
		type: 'oauth',
		token: token
	});

	if (process.argv.length < 4) {
		printHelp();
		process.exit();
	}

	if (!fs.existsSync(path.join(HOME, '.dependency-hunter'))) fs.mkdirSync(path.join(HOME, '.dependency-hunter'));

	var command = (process.argv[2] || '').toLowerCase();
	var organization = process.argv[3];
	var moduleName = process.argv[4];

	if (command === 'update') {
		update(organization);
	} else if (command === 'list') {
		listModules(organization);
	} else if (command === 'find') {
		if (!moduleName) {
			console.log('No module name.');
			printHelp();
			process.exit();
		}

		findModule(organization, moduleName);
	} else {
		console.log('Wrong command: %s', command);
		printHelp();
	}
});