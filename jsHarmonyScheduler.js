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

var _ = require('lodash');
var jsHarmonyModule = require('jsharmony/jsHarmonyModule');
var jsHarmonySchedulerController = require('./jsHarmonySchedulerController.js');
var jsHarmonySchedulerConfig = require('./jsHarmonySchedulerConfig.js');
var funcs = require('./models/_funcs.js');

function jsHarmonyScheduler(name, options){
  options = _.extend({
    schema: 'jsharmony',
    existingSchema: true,
  }, options);

  var _this = this;
  jsHarmonyModule.call(this, name);
  _this.Config = new jsHarmonySchedulerConfig();

  if(name) _this.name = name;
  _this.typename = 'jsHarmonyScheduler';

  _this.schema = options.schema;
  _this.existingSchema = options.existingSchema;
  _this.funcs = new funcs(_this);
}

jsHarmonyScheduler.prototype = new jsHarmonyModule();

function getMainSite(jsh){
  if(jsh && jsh.Sites && jsh.Modules && jsh.Modules.jsHarmonyFactory){
    return jsh.Sites[jsh.Modules.jsHarmonyFactory.mainSiteID];
  }
  return undefined;
}

jsHarmonyScheduler.prototype.onModuleAdded = function(jsh){
  var _this = this;
  _this.controller = new jsHarmonySchedulerController(_this);

  if(!jsh.XValidate._v_jsHarmonySchedulerRRULE){
    jsh.XValidate._v_jsHarmonySchedulerRRULE = function(){
      return function(_caption, _val, _obj){
        //Do not run the validator if the field is blank
        if((typeof _val == 'undefined')||(_val==='')||(_val===null)) return '';
        _val = _val.toString().trim();
        if(!_val) return '';
        
        var err = _this.controller.validateRRULE(_val, _obj.schedule_config);
        if(err) return _caption+' must be a valid rule: '+err;
        return '';
      };
    };
    jsh.XValidate._v_jsHarmonySchedulerRRULE.runat = ['server'];
  }

  if(!jsh.XValidate._v_jsHarmonySchedulerRDATE){
    jsh.XValidate._v_jsHarmonySchedulerRDATE = function(){
      return function(_caption, _val, _obj){
        //Do not run the validator if the field is blank
        if((typeof _val == 'undefined')||(_val==='')||(_val===null)) return '';
        _val = _val.toString().trim();
        if(!_val) return '';
        var err = _this.controller.validateRDATE(_val, _obj.schedule_config);
        if(err) return _caption+' must be a valid date set: '+err;
        return '';
      };
    };
    jsh.XValidate._v_jsHarmonySchedulerRDATE.runat = ['server'];
  }

  jsh.Config.onConfigLoaded.push(function(cb){
    var mainSite = getMainSite(_this.jsh);
    if(mainSite){
      if(!mainSite.private_apps) mainSite.private_apps = [];
      mainSite.private_apps.push({'/_funcs/jsHarmonyScheduler/schedule_task_log/:schedule_task_id': _this.funcs.schedule_task_log});
      mainSite.private_apps.push({'/_funcs/jsHarmonyScheduler/schedule/:schedule_id/upcoming': _this.funcs.schedule_upcoming});
    }
    return cb();
  });
  
  jsh.Config.onServerReady.push(function (cb, servers){
    _this.controller.run();
    return cb();
  });
};

module.exports = exports = jsHarmonyScheduler;