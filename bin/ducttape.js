#!/usr/bin/env node

var path = require('path');
var ducttape = require('../lib/ducttape');
var utils = require('../lib/utils');

var opts = utils.getOpts();

ducttape.apply(path.resolve(), opts);