#!/usr/bin/env node

var ghauth = require('ghauth');
var ghApi = require('github');
var req = require('request');
var log = require('single-line-log').stdout;
var fs = require('fs');
var path = require('path');
var readline = require('readline');

var github = new ghApi({
	version: '3.0.0'
});

var update = function(organization) {
	var getAllRepos = function(callback) {
		var page = 1;
		var res = [];

		(function loop() {
			github.repos.getFromOrg({
				org: organization,
				per_page: 100,
				page: page
			}, function(err, repos) {
				if (err) return callback(err);
				if (!repos.length) return callback(null, res);
				res = res.concat(repos);
				page++;
				loop();
			});
		})();
	};

	getAllRepos(function(err, repos) {
		if (err) return console.log(err);

		var result = {};
		var onend = function() {
			var data = {
				date: new Date(),
				repositories: result
			};

			fs.writeFile(path.join(process.env.HOME, '.dependency-hunter/'+organization+'.json'), JSON.stringify(data), function(err) {
				if (err) return console.error(err);
				log.clear();
				console.log('\nDone');
			});
		};
		(function next() {
			var repository = repos.pop();

			if (!repository) return onend();

			log('Left to download:', repos.length);

			req('https://'+config.user+':'+config.pass+'@raw.githubusercontent.com/'+organization+'/'+repository.name+'/master/package.json', function(err, res) {
				if (err) return console.error(err);

				if (res.statusCode !== 200) return next();

				var body;
				try { body = JSON.parse(res.body); }
				catch(e) {
					console.log('Could not parse body for '+repository.name);
					console.log(res.body, e, repository);
					return next();
				}

				result[repository.name] = {
					dependencies: body.dependencies,
					devDependencies: body.devDependencies
				};

				next();
			});
		})();
	});
};
var findModule = function(organization, module) {
	if (!fs.existsSync(path.join(process.env.HOME, '.dependency-hunter/'+organization+'.json'))) {
		console.log('Data doesn\'t exist for %s. Please run "%s update".', organization, organization);
		process.exit();
	}

	fs.readFile(path.join(process.env.HOME, '.dependency-hunter/'+organization+'.json'), function(err, data) {
		if (err) return console.error(err);

		data = JSON.parse(data);

		var print = function(type) {
			var count = 0;
			Object.keys(data.repositories).forEach(function(name) {
				var repo = data.repositories[name];
				var version = (repo[type] || {})[module];
				if (version !== undefined) {
					count++;
					console.log('%s is using %s, version: %s', name, module, version);
				}
			});

			console.log('Found %s %s', count, type);
		};

		print('dependencies');
		console.log('');
		print('devDependencies');
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
	if (err) return console.error(err);

	github.authenticate({
		type: 'oauth',
		token: result.token
	});

	if (process.argv.length < 4) {
		printHelp();
		process.exit();
	}

	if (!fs.existsSync(path.join(process.env.HOME, '.dependency-hunter'))) fs.mkdirSync(path.join(process.env.HOME, '.dependency-hunter'));

	var organization = process.argv[2];
	var command = (process.argv[3] || '').toLowerCase();
	var moduleName = process.argv[4];

	if (command === 'update') {
		update(organization);
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