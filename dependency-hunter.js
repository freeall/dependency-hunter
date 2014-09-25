#!/usr/bin/env node

var ghauth = require('ghauth');
var ghApi = require('github');
var req = require('request');
var log = require('single-line-log').stdout;
var fs = require('fs');
var path = require('path');
var readline = require('readline');
var afterAll = require('after-all');

var HOME = process.env.HOME || process.env.USERPROFILE;

var github = new ghApi({
	version: '3.0.0'
});

var update = function(organization, token) {
	var listOfRepos = function(callback) {
		var page = 1;
		var res = [];
		var type = 'User';

		var onend = function() {
			if (type === 'User' && !res.length) {
				type = 'Org';
				next();
				return;
			}
			callback(null, res);
		};

		var next = function() {
			log('Getting list of repositories from '+organization+'. Page: #'+page);
			github.repos['getFrom'+type]({
				org: organization,
				user: organization,
				type: 'all',
				per_page: 100,
				page: page
			}, function(err, repos) {
				if (err) return callback(err);
				if (!repos.length) return onend();

				res = res.concat(repos);
				page++;
				next();
			});
		};

		next();
	};

	listOfRepos(function(err, repos) {
		if (err) throw err;

		var left = repos.length;
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

		repos.forEach(function(repository) {
			var onend = next();

			github.repos.getContent({
				user: organization,
				repo: repository.name,
				path: '/package.json'
			}, function(err, res) {
				log('Left to download:', --left);

				if (err && err.code === 404) return onend();
				if (err) throw err;

				var body;
				try {
					body = JSON.parse(new Buffer(res.content, 'base64'));
				}
				catch(e) {
					console.log('Could not parse body for '+repository.name);
					console.log(res);
					return onend();
				}

				result[repository.name] = {
					dependencies: body.dependencies,
					devDependencies: body.devDependencies
				};

				onend();
			});
		});

	});
};
var findModule = function(organization, module) {
	if (!fs.existsSync(path.join(HOME, '.dependency-hunter/'+organization+'.json'))) {
		console.log('Data doesn\'t exist for %s. Please run "%s update".', organization, organization);
		process.exit();
	}

	fs.readFile(path.join(HOME, '.dependency-hunter/'+organization+'.json'), function(err, data) {
		if (err) throw err;

		data = JSON.parse(data);

		var print = function(type) {
			var count = 0;
			Object.keys(data.repositories).forEach(function(name) {
				var repo = data.repositories[name];
				var version = (repo[type] || {})[module];
				// Module is NOT in the repo
				if (module[0] === '-' && version === undefined) {
					count++;
					console.log('%s is not using %s', name, module.substr(1));
					return;
				}
				// Module IS in the repo
				if (version !== undefined) {
					count++;
					console.log('%s is using %s, %s', name, module, version);
				}
			});

			console.log('Found %s %s', count, type);
		};

		if (module[0] === '-') {
			print('repositories');
		} else {
			print('dependencies');
			console.log('');
			print('devDependencies');
		}
		console.log('\nData for %s was last updated: %s', organization, data.date);
	});
};
var printHelp = function() {
	console.log('Please use:');
	console.log('  ORGANIZATION update. Updates the data for organization.');
	console.log('  ORGANIZATION find MODULE. Locates the repositories who depends on MODULE');
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

	var organization = process.argv[2];
	var command = (process.argv[3] || '').toLowerCase();
	var moduleName = process.argv[4];

	if (command === 'update') {
		update(organization, token);
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