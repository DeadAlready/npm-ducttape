'use strict';

module.exports.clearFolderSync = clearFolderSync;
module.exports.promisifyPipe = promisifyPipe;
module.exports.getOpts = getOpts;
module.exports.joinFlags = joinFlags;

/**********************/

var fs = require('fs');
var path = require('path');

function clearFolderSync (root, target) {
    var dirname = path.join(root, target);
    try {
        fs.readdirSync(dirname)
            .map(function (file) {
                return path.join(dirname, file);
            })
            .forEach(fs.unlinkSync);
    } catch(error) {
        if(error.code === 'ENOENT') {
            fs.mkdirSync(dirname);
        } else {
            throw error;
        }
    }
}

function promisifyPipe(instream, outstream) {
    return new Promise(function (resolve, reject) {
        var sent = false;
        function innerReject(err) {
            if(!sent) {
                sent = true;
                reject(err);
            }
        }
        function innerResolve() {
            if(!sent) {
                sent = true;
                resolve();
            }
        }
    
        instream.on('error', innerReject);
        outstream.on('error', innerReject);
    
        outstream.on('close', innerResolve);
        outstream.on('finish', innerResolve);
    
        instream.pipe(outstream);
    });
}

function getOpts() {
    var argv = process.argv.slice(0).splice(2);
    var _default = {
        target: '.packages',
        shrinkwrap: []
    };
    
    argv.forEach(function (opt) {
        if(opt === '--dev') {
            _default.shrinkwrap.push(opt);
        } else if(_default.target === '.packages') { // only use the first 
            _default.target = opt;
        }
    });
    
    return _default;
}

function joinFlags(cmd, flags) {
    if(Array.isArray(flags) && flags.length) {
        cmd += ' ' + flags.join(' ');
    }
    return cmd;
}