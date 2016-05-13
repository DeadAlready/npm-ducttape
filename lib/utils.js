'use strict';

module.exports.clearFolderSync = clearFolderSync;
module.exports.promisifyPipe = promisifyPipe;

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