/*
Copyright 2022 apHarmony

This file is part of jsHarmony.

jsHarmony is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

jsHarmony is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with this package.  If not, see <http://www.gnu.org/licenses/>.
*/

var jsHarmonyConfig = require('jsharmony/jsHarmonyConfig');
var path = require('path');

function jsHarmonySchedulerConfig(){
  //Module path
  this.moduledir = path.dirname(module.filename);

  //Disable the scheduler
  this.disabled = false;
  //Time between checks for new jobs
  this.checkDelay = 1000;
}

jsHarmonySchedulerConfig.prototype = new jsHarmonyConfig.Base();

jsHarmonySchedulerConfig.prototype.Init = function(cb, jsh){
  if(cb) return cb();
};

exports = module.exports = jsHarmonySchedulerConfig;