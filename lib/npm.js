'use strict';

module.exports.create = create;

/**********************/

var fs = require('fs');
var path = require('path');
var childProcess = require('child_process')

var utils = require('./utils');

function NPM(dirname, folder) {

    if(!path.isAbsolute(dirname)) {
        throw new TypeError('root must be an absolute path');
    }

    this._dir = dirname;
    this._target = folder;
    this._fullTargetPath = path.join(dirname, folder);
    this._cache = this.getCache();
    this._shrinkwrapLocation = path.join(this._dir, 'npm-shrinkwrap.json');

    if(this._fullTargetPath.indexOf(dirname) !== 0) {
        throw new Error('target folder must be a subfolder of the root');
    }
}

NPM.prototype.run = function run(cmd) {
    return childProcess.execSync('npm ' + cmd, {cwd: this._dir}).toString('utf8');
};

NPM.prototype.shrinkwrap = function shrinkwrap() {
    var shrinkWrapExec = this.run('shrinkwrap -s');

    if(shrinkWrapExec.indexOf('wrote npm-shrinkwrap.json') === -1) {
        console.error('Shrinkwrap command failed');
        throw new Error(shrinkWrapExec);
    }
};

NPM.prototype.getShrinkwrap = function getShrinkwrap() {
    return JSON.parse(fs.readFileSync(this._shrinkwrapLocation, 'utf8'));
};

NPM.prototype.setShrinkwrap = function setShrinkwrap(data) {
    fs.writeFileSync(this._shrinkwrapLocation, JSON.stringify(data, undefined, 2), 'utf8');
};

NPM.prototype.listDependencies = function listDependencies(obj, name, prefix) {
    var $this = this;
    name = name || '';
    prefix = prefix || '';

    var newObj = {
        dependencies: {}
    };
    var list = [];
    Object.keys(obj).forEach(function (key) {
        if(key !== 'dependencies') {
            newObj[key] = obj[key];
            return;
        }

        var newPrefix = name ? ['..','..'].join('/') : '';
        Object.keys(obj.dependencies).forEach(function (depKey) {
            var result = $this.listDependencies(obj.dependencies[depKey], depKey, newPrefix);
            list = list.concat(result.list);
            newObj.dependencies[depKey] = result.dependencies;
        });
    });

    if(!name) {
        // No name, so don't include itself
        return {
            dependencies: newObj,
            list: list
        };
    }

    var fileName = name + '-' + newObj.version + '.tgz';
    var filePath = path.join($this._fullTargetPath, fileName);
    var pathParts = [$this._target, fileName];
    if(prefix) {
        pathParts.unshift(prefix);
    }
    if(obj.resolved) {
        list.push({
            packageName: name,
            versionName: newObj.version,
            filePath: filePath,
            url: newObj.resolved
        });
        newObj.resolved = 'file:' + pathParts.join('/');
    }

    return {
        dependencies: newObj,
        list: list
    };
};

NPM.prototype.getCache = function getCache() {
    return this.run('config get cache').replace(/\s/g, '');
};

NPM.prototype.pack = function pack(url) {
    var $this = this;
    return new Promise(function (resolve, reject) {
        childProcess.exec('npm pack ' + url, {cwd: $this._fullTargetPath}, function (err, stdout, stderr) {
            if(err || stderr) {
                reject(err || stderr);
                return;
            }
            resolve(stdout);
        });
    });
};

NPM.prototype.getFileFromCache = function getFileFromCache(data) {
    var cachePath = path.join(this._cache, data.packageName, data.versionName, 'package.tgz');
    return utils.promisifyPipe(fs.createReadStream(cachePath), fs.createWriteStream(data.filePath, 'utf8'));
};

NPM.prototype.getFile = function getFile(data) {
    var $this = this;
    return $this.getFileFromCache(data)
        .catch(function () {
            return $this.pack(data.url);
        });
};

NPM.prototype.getFiles = function getFiles(datas) {
    var $this = this;
    return Promise.all(datas.map(function (data) {
        return $this.getFile(data);
    }));
};

function create (dirname, target) {
    return new NPM(dirname, target);
}