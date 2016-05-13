#!/usr/bin/env node

var path = require('path');
var ducttape = require('../lib/ducttape');

ducttape.apply(path.resolve(), process.argv[2] || '.packages');