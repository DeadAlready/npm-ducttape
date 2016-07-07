'use strict';

module.exports.apply = apply;

/*********************************/

var utils = require('./utils');
var NPM = require('./npm');

function apply(root, opts) {
    var npm = NPM.create(root, opts.target);
    
    //Get possible flags for shrinkwrap (--dev)
    if(opts.shrinkwrap.length) {
        console.log('flags provided for shrinkwrap', opts.shrinkwrap);
    }

    //Run shrinkwrap
    npm.shrinkwrap(opts.shrinkwrap);
    console.log('shrinkwrap successful');

    //Require shrinkwrap results
    var shrinkwrapData = npm.getShrinkwrap();
    if(!shrinkwrapData.dependencies || Object.keys(shrinkwrapData.dependencies).length < 1) {
        // No dependencies, nothing to do
        console.log('No dependencies');
        return;
    }

    //Clear the folder
    utils.clearFolderSync(root, opts.target);
    console.log('folder cleared');

    var result = npm.listDependencies(shrinkwrapData);
    console.log('A total of', result.list.length, 'dependencies found');

    return npm.getFiles(result.list)
        .then(function () {
            console.log('files consolidated');
            
            //Write new shrinkwrap file
            npm.setShrinkwrap(result.dependencies);
            console.log('new npm-shrinkwrap.json written');
        });
}
