'use strict';

module.exports.create = create;

/**********************/

var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

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
    this._isNewer = this._isNewerVersion();

    if(this._fullTargetPath.indexOf(dirname) !== 0) {
        throw new Error('target folder must be a subfolder of the root');
    }
}

NPM.prototype.run = function run(cmd) {
    var finalCmd = 'npm ' + cmd;
    console.log('running', finalCmd);

    return childProcess.execSync(finalCmd, {cwd: this._dir}).toString('utf8');
};

NPM.prototype.shrinkwrap = function shrinkwrap(flags) {
    try {
        var cmd = utils.joinFlags('shrinkwrap', flags);
        this.run(cmd);
    } catch(e) {
        console.error('Shrinkwrap command failed');
        console.error('You most probably need to run npm prune and/or npm install first');
        console.error('Refer to error above');
        process.exit(1);
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

        var newPrefix = !name || $this._isNewer ? '' : prefix ? ['..','..', prefix].join('/') : ['..','..'].join('/');
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

    // npm pack will remove @ symbols from the name.
    var santitizedName = name.replace(/[@]/, '');
    // slashes are converted into dashes by npm pack
    santitizedName = santitizedName.replace(/[/]/, '-');

    var fileName = santitizedName + '-' + newObj.version + '.tgz';
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

NPM.prototype.getVersion = function getCache() {
    return this.run('-v').replace(/\s/g, '');
};

NPM.prototype._isNewerVersion = function _isNewerVersion() {
    var version = this.getVersion();
    var semverNrs = version.split('.').map(function (nr) {
        return parseInt(nr, 10);
    });
    if(semverNrs[0] < 3) {
        return false;
    }
    if(semverNrs[1] < 10) {
        return false;
    }
    return semverNrs[2] >= 8;
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
