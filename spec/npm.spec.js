'use strict';

var childProcess = require('child_process');
var NPM = require('../lib/npm');
var path = require('path');
var rimraf = require('rimraf');
var fs = require('fs');

var root = path.join(__dirname, 'test');
var target = '.packages';
var swPath = path.join(root, 'npm-shrinkwrap.json');


describe('NPM', function() {
    beforeAll(function () {
        try {
            fs.mkdirSync(root);
        } catch(e) {
            if(e.code === 'EEXIST') {
                rimraf.sync(root);
                fs.mkdirSync(root);
            }
        }
    });
    afterAll(function () {
        rimraf.sync(root);
    });

    it('should throw an error if non-absolute root', function() {
        expect(function () {
            NPM.create('./what', target);
        }).toThrowError();
    });

    it('should throw an error if target is outside root', function() {
        expect(function () {
            NPM.create(root, '../what');
        }).toThrowError();
    });

    it('should initialize if all ok', function() {
        expect(function () {
            NPM.create(root, target);
        }).not.toThrowError();
    });

    it('should have correct internal variables', function() {
        spyOn(childProcess, 'execSync').and.callThrough();
        var npm = NPM.create(root, target);
        expect(npm._dir).toEqual(root);
        expect(npm._target).toEqual(target);
        expect(npm._fullTargetPath).toEqual(path.join(root, target));
        expect(npm._shrinkwrapLocation).toEqual(swPath);
        expect(typeof npm._cache).toBe('string')
        
        expect(childProcess.execSync).toHaveBeenCalled();
        expect(childProcess.execSync).toHaveBeenCalledWith('npm config get cache', {cwd: root});
    });

    it('should be able to write npm-shrinkwrap.json', function() {
        var npm = NPM.create(root, target);
        npm.setShrinkwrap({test: true});
        expect(require(swPath)).toEqual({test:true});
    });

    it('should be able to get npm-shrinkwrap.json', function() {
        fs.writeFileSync(swPath, JSON.stringify({test2:true}));
        var npm = NPM.create(root, target);
        expect(npm.getShrinkwrap()).toEqual({test2:true});
    });

    it('should call npm shrinkwrap', function() {
        spyOn(childProcess, 'execSync').and.returnValue('wrote npm-shrinkwrap.json');
        var npm = NPM.create(root, target);
        npm.shrinkwrap();
        expect(childProcess.execSync).toHaveBeenCalled();
        expect(childProcess.execSync).toHaveBeenCalledWith('npm shrinkwrap -s', {cwd: root});
    });

});