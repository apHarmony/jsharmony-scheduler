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
var async =require('async');
var rrule = require('rrule');
var moment = require('jsharmony/lib/moment');
var Helper = require('jsharmony/Helper');
var path = require('path');

module.exports = exports = function jsHarmonySchedulerController(module){
  var _this = this;
  var jsh = module.jsh;

  _this.isRunning = false;
  _this.runNextLoopImmediately = false;
  _this.taskTimer = null;
  _this.initialized = false;

  _this.init = function(callback){
    var appsrv = jsh.AppSrv;
    appsrv.ExecScalar('scheduler', module.replaceSchema("update {schema}.schedule_task set schedule_task_rslt='FAIL' where schedule_task_rslt='RUNNING'"), [], {}, function (err, rslt) {
      if(err){ jsh.Log.error(err); return callback(); }
      return callback();
    });
  };

  _this.run = function(){
    if(!_this.initialized){
      _this.initialized = true;
      return _this.init(function(){ _this.run(); });
    }

    if(_this.isRunning){
      _this.runNextLoopImmediately = true;
      return;
    }
    _this.isRunning = true;

    if(_this.taskTimer) clearTimeout(_this.taskTimer);
    _this.taskTimer =  null;

    function scheduleNextLoop(timeout){
      _this.taskTimer = setTimeout(function(){ _this.run(); }, (_this.runNextLoopImmediately ? 1 : timeout));
      _this.runNextLoopImmediately = false;
      _this.isRunning = false;
    }

    if (module.Config.disabled){
      return scheduleNextLoop(module.Config.checkDelay);
    }

    _this.checkTask(function(task){
      if(task){
        _this.runNextLoopImmediately = true;
        return _this.execTask(task, function(err){
          if(err){
            jsh.Log.error(err);
            return _this.resultTaskFail(task, err.toString(), function(){
              return scheduleNextLoop(module.Config.checkDelay);
            });
          }
          else{
            return scheduleNextLoop(module.Config.checkDelay);
          }
        });
      }
      else {
        _this.checkSchedule(function(err, task){
          Helper.execif(task,
            function(f){
              _this.runNextLoopImmediately = true;
              _this.createTask(task, f);
            },
            function(){
              return scheduleNextLoop(module.Config.checkDelay);
            }
          );
        });
      }
    });
  };

  _this.dateAddUTCOffset = function(dt){
    return moment.utc(moment(dt).format('YYYYMMDDTHHmmss')+'Z');
  };

  _this.dateSubUTCOffset = function(dt){
    return moment(moment.utc(dt).format('YYYYMMDDTHHmmss'));
  };

  _this.getNextDate = function(fullTask, fromDate){
    if(!fromDate) fromDate = new Date();
    fromDate = _this.dateAddUTCOffset(fromDate).toDate();
    var task = _.pick(fullTask, ['schedule_start_tstmp','schedule_rrule','schedule_rdate','schedule_exrule','schedule_exdate']);
    _.each(['schedule_rrule','schedule_rdate','schedule_exrule','schedule_exdate'], function(key){
      task[key] = (task[key]||'').toString().trim();
      if(task[key]) task[key] = Helper.ReplaceParams(task[key], fullTask.schedule_data || {});
    });
    var rulestr =
      'DTSTART:' + _this.dateAddUTCOffset(task.schedule_start_tstmp).format('YYYYMMDDTHHmmss')+'Z'+
      (task.schedule_rrule ? '\nRRULE:' + task.schedule_rrule : '\nRRULE:COUNT=1')+
      (task.schedule_rdate ? '\nRDATE' + ((task.schedule_rdate.indexOf(':')>=0)?';':':') + task.schedule_rdate : '')+
      (task.schedule_exrule ? '\nEXRULE:' + task.schedule_exrule : '')+
      (task.schedule_exdate ? '\nEXDATE' + ((task.schedule_exdate.indexOf(':')>=0)?';':':') + task.schedule_exdate : '');
    var rule = rrule.rrulestr(rulestr);
    var nextDate = rule.after(fromDate);
    if(nextDate) nextDate = _this.dateSubUTCOffset(nextDate).toDate();
    return nextDate;
  };

  _this.validateRRULE = function(str, schedule_config_str){
    var schedule_config = {};
    if(schedule_config_str){
      try{
        schedule_config = JSON.parse(schedule_config_str);
      }
      catch(ex){ /* Do nothing */ }
    }
    var params = {};
    if(schedule_config && schedule_config.data){
      for(var key in schedule_config.data){
        var dataConfig = schedule_config.data[key];
        params[key] = '';
        if(dataConfig.type == 'date') params[key] = '20200202';
        else if(dataConfig.type == 'datetime') params[key] = '20200202T101010Z';
      }
    }
    try{
      var rulestr =
        'DTSTART:' + moment().format('YYYYMMDDTHHmmss')+'Z'+
        '\nRRULE:' + str;
      rrule.rrulestr(Helper.ReplaceParams(rulestr, params));
    }
    catch(ex){
      if(ex && ex.message) return ex.message;
      return 'Invalid RRULE';
    }
    return '';
  };

  _this.validateRDATE = function(str, schedule_config_str){
    var schedule_config = {};
    if(schedule_config_str){
      try{
        schedule_config = JSON.parse(schedule_config_str);
      }
      catch(ex){ /* Do nothing */ }
    }
    var params = {};
    if(schedule_config && schedule_config.data){
      for(var key in schedule_config.data){
        var dataConfig = schedule_config.data[key];
        params[key] = '';
        if(dataConfig.type == 'date') params[key] = '20200202';
        else if(dataConfig.type == 'datetime') params[key] = '20200202T101010Z';
      }
    }
    try{
      var rulestr =
        'DTSTART:' + moment().format('YYYYMMDDTHHmmss')+'Z'+
        '\nRRULE:FREQ=DAILY;INTERVAL=1'+
        '\nEXDATE' + ((str.indexOf(':')>=0)?';':':') + str;
      rrule.rrulestr(Helper.ReplaceParams(rulestr, params));
    }
    catch(ex){
      if(ex && ex.message) return ex.message;
      return 'Invalid RRULE';
    }
    return '';
  };

  _this.checkSchedule = function(callback, options){ /* callback = function(err, task){} */
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    options = _.extend({ schedule_id: null, get_task: false }, options);

    //Get next schedule task from DB
    let sql = [
      'select $topn(1,',
      '    schedule_id, schedule_name, schedule_start_tstmp, schedule_rrule, schedule_rdate, schedule_exrule, schedule_exdate, schedule_next_tstmp, schedule_window, schedule_retry_count, schedule_retry_delay, schedule_config,',
      "    (select count(*) from {schema}.schedule_task where schedule_task.schedule_id = schedule.schedule_id and schedule_task_etstmp >= schedule_next_tstmp and schedule_task_rslt = 'FAIL' and schedule_task_type = 'AUTO') fail_count,",
      "    (select max(schedule_task_rslt_tstmp) from {schema}.schedule_task where schedule_task.schedule_id = schedule.schedule_id and schedule_task_etstmp >= schedule_next_tstmp and schedule_task_rslt = 'FAIL' and schedule_task_type = 'AUTO') last_fail_tstmp",
      '  from {schema}.schedule',
      '  where ',
      (options.schedule_id?
        'schedule_id=@schedule_id':
        "schedule_sts='ACTIVE' and schedule_start_tstmp <= jsharmony.my_now() and schedule_next_tstmp <= jsharmony.my_now()"
      ),
      '  order by schedule_next_tstmp, schedule_id',
      ')',
    ].join(' ');
    var sql_ptypes = [];
    var sql_params = {};
    if(options.schedule_id){
      sql_ptypes.push(dbtypes.BigInt);
      sql_params.schedule_id = options.schedule_id;
    }
    appsrv.ExecRow('scheduler', module.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
      if(err){ jsh.Log.error(err); return callback(err); }
      //No upcoming task found
      if(!rslt || !rslt.length || !rslt[0]) return callback();

      var task = rslt[0];

      _this.getScheduleData(task, function(err, schedule_data){
        if(err){ jsh.Log.error(err); return callback(err); }
        task.schedule_data = schedule_data;
        if(options.get_task) return callback(null, task);

        //If task exceeds window, get next run date from [curtime - window]
        var curDate = new Date();
        var schedule_next_tstmp = null;
        if(task.schedule_next_tstmp){
          schedule_next_tstmp = new Date(task.schedule_next_tstmp);
          var schedule_window = parseInt(task.schedule_window);
          if(moment(schedule_next_tstmp).add(schedule_window, 's').toDate() < curDate){
            schedule_next_tstmp = (_this.getNextDate(task, moment(curDate).add(-1*schedule_window, 's').toDate()));
          }
        }

        //If task is still within window
        if(schedule_next_tstmp && (schedule_next_tstmp <= curDate)){
          //If the fail count was not exceeded
          var schedule_retry_count = parseInt(task.schedule_retry_count);
          var fail_count = parseInt(task.fail_count);
          if((fail_count==0) || (schedule_retry_count < 0) || (schedule_retry_count > fail_count)){
            if(fail_count && (moment(task.last_fail_tstmp).add(parseInt(task.schedule_retry_delay), 's').toDate() > curDate)){
              //Wait for retry timeout
              return callback();
            }
            //Run task
            return callback(null, task);
          }
        }
        
        //Update next run timestamp to a future date
        var schedule_following_tstmp = _this.getNextDate(task);
        if(!schedule_following_tstmp) schedule_following_tstmp = null;
        appsrv.ExecScalar('scheduler', module.replaceSchema('update {schema}.schedule set schedule_next_tstmp=@schedule_next_tstmp where schedule_id=@schedule_id'), [dbtypes.BigInt, dbtypes.DateTime(7)], { schedule_id: task.schedule_id, schedule_next_tstmp: schedule_following_tstmp }, function (err, rslt) {
          if(err){ jsh.Log.error(err); return callback(err); }
          return callback();
        });
      });
    });
  };

  _this.getUpcoming = function(schedule_id, cnt, callback /* function(err, upcoming_dates){} */){
    _this.checkSchedule(function(err, fullTask){
      if(err) return callback(err);
      if(!fullTask) return callback('Error loading task');

      var fromDate = _this.dateAddUTCOffset(new Date()).toDate();
      var task = _.pick(fullTask, ['schedule_start_tstmp','schedule_rrule','schedule_rdate','schedule_exrule','schedule_exdate']);
      _.each(['schedule_rrule','schedule_rdate','schedule_exrule','schedule_exdate'], function(key){
        task[key] = (task[key]||'').toString().trim();
        if(task[key]) task[key] = Helper.ReplaceParams(task[key], fullTask.schedule_data || {});
      });
      var rulestr =
        'DTSTART:' + _this.dateAddUTCOffset(task.schedule_start_tstmp).format('YYYYMMDDTHHmmss')+'Z'+
        (task.schedule_rrule ? '\nRRULE:' + task.schedule_rrule : '\nRRULE:COUNT=1')+
        (task.schedule_rdate ? '\nRDATE' + ((task.schedule_rdate.indexOf(':')>=0)?';':':') + task.schedule_rdate : '')+
        (task.schedule_exrule ? '\nEXRULE:' + task.schedule_exrule : '')+
        (task.schedule_exdate ? '\nEXDATE' + ((task.schedule_exdate.indexOf(':')>=0)?';':':') + task.schedule_exdate : '');
      var rule = rrule.rrulestr(rulestr);
      var upcoming_dates = [];
      rule.between(fromDate, new Date(8640000000000000), false, function(nextDate, idx){
        if(nextDate) nextDate = _this.dateSubUTCOffset(nextDate);
        upcoming_dates.push(nextDate.format('YYYY-MM-DD h:mm:ss a'));
        if(idx >= cnt) return false;
        return true;
      });
      
      return callback(null, upcoming_dates);
    }, { schedule_id: schedule_id, get_task: true });
  };

  _this.getScheduleData = function(task, callback){
    var schedule_data = {};
    var schedule_config_str = (task.schedule_config || '').toString().trim();
    var schedule_config = {};
    try{
      if(schedule_config_str) schedule_config = JSON.parse(schedule_config_str);
    }
    catch(ex){
      return callback('Invalid schedule config: '+schedule_config_str);
    }
    
    if(!schedule_config || !schedule_config.data) return callback(null, schedule_data);
    var dataKeys = _.keys(schedule_config.data);
    async.eachSeries(dataKeys, function(dataKey, data_cb){
      var dataConfig = schedule_config.data[dataKey];
      schedule_data[dataKey] = '';
      if(!dataConfig.sql) return data_cb();
      jsh.AppSrv.ExecRecordset('scheduler', module.replaceSchema(dataConfig.sql), [], { }, function (err, rslt) {
        if(err){ return data_cb(err); }
        if(!rslt || !rslt.length || !rslt[0]) return data_cb();
        var vals = [];
        _.each(rslt[0], function(row){
          for(var key in row){
            var val = row[key];
            if((dataConfig.type=='date')||(dataConfig.type=='datetime')){
              val = Helper.ParseDate(val);
              if(_.isDate(val)){
                if(dataConfig.type=='date') val = moment(val).format('YYYYMMDD');
                else if(dataConfig.type=='datetime') val = moment(val).format('YYYYMMDDTHHmmss')+'Z';
              }
            }
            vals.push(val);
            break;
          }
        });
        if(vals.length) schedule_data[dataKey] = vals.join(',');
        return data_cb();
      });
    }, function(err){
      if(err) return callback(err);
      //Post-process
      async.eachSeries(dataKeys, function(dataKey, data_cb){
        var dataConfig = schedule_config.data[dataKey];
        if(!dataConfig.post_process) return data_cb();
        var base_callback = data_cb; // eslint-disable-line no-unused-vars
        //function(schedule_data, callback){}
        var jscmd = '(function(){ var callback = function(err){ base_callback(err); }; return (function(){'+dataConfig.post_process+'})();}).call(schedule_data)';
        eval(jscmd);
      }, function(err){
        if(err) return callback(err);
        return callback(null, schedule_data);
      });
    });
  };

  _this.checkTask = function(callback){ /* callback = function(task){} */
    var appsrv = jsh.AppSrv;

    //Get next scheduled task from DB
    let sql = [
      'select $topn(1,',
      '    schedule_task_id, schedule_task_params, schedule_task_log,',
      '    schedule_task.schedule_id, schedule_name, schedule_start_tstmp, schedule_rrule, schedule_rdate, schedule_exrule, schedule_exdate,',
      '    schedule_timeout, schedule_action_type, schedule_action, schedule_params, schedule_config',
      '  from {schema}.schedule_task',
      '    inner join {schema}.schedule on schedule.schedule_id = schedule_task.schedule_id',
      "  where schedule_task_rslt='PENDING'",
      '  order by schedule_task_etstmp, schedule_task_id',
      ')',
    ].join(' ');
    appsrv.ExecRow('scheduler', module.replaceSchema(sql), [], { }, function (err, rslt) {
      if(err){ jsh.Log.error(err); return callback(); }
      //No upcoming task found
      if(!rslt || !rslt.length || !rslt[0]) return callback();

      var task = rslt[0];
      return callback(task);
    });
  };

  _this.createTask = function(task, callback){
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    let sql = [
      "insert into {schema}.schedule_task(schedule_id, schedule_task_type) values(@schedule_id, 'AUTO');",
    ].join(' ');
    var sql_ptypes = [dbtypes.BigInt];
    var sql_params = { schedule_id: task.schedule_id};
    appsrv.ExecScalar('scheduler', module.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
      if(err){ jsh.Log.error(err); return callback(); }
      return callback();
    });
  };

  _this.execTask = function(task, callback){
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    _this.getScheduleData(task, function(err, schedule_data){
      if(err){  _this.taskLog.error(task, err); return callback(); }
      task.schedule_data = schedule_data;

      //Parse params
      var schedule_params_str = (task.schedule_params || '').toString().trim();
      var schedule_params = {};
      try{
        if(schedule_params_str) schedule_params = JSON.parse(schedule_params_str);
        if(schedule_params){
          var schedule_param_keys = _.keys(schedule_params);
          _.each(schedule_param_keys, function(key){
            if(schedule_params[key] && schedule_params[key].js){
              schedule_params[key].js = '(function(){' + schedule_params[key].js + '}());';
              schedule_params[key] = Helper.JSEval(schedule_params[key].js, task, { jsh: jsh });
            }
          });
        }
      }
      catch(ex){
        return callback('Invalid schedule params: '+ex.toString()+' :: '+schedule_params_str);
      }

      var task_params_str = (task.schedule_task_params || '').toString().trim();
      var task_params = {};
      try{
        if(task_params_str) task_params = JSON.parse(task_params_str);
      }
      catch(ex){
        return callback('Invalid schedule params: '+task_params_str);
      }
      task_params = _.extend({}, schedule_params, task_params);

      //Parse config
      var schedule_config_str = (task.schedule_config || '').toString().trim();
      var schedule_config = {};
      try{
        if(schedule_config_str) schedule_config = JSON.parse(schedule_config_str);
      }
      catch(ex){
        return callback('Invalid schedule config: '+schedule_config_str);
      }

      var schedule_task_log = task.schedule_task_log || null;
      if(!schedule_task_log && schedule_config && schedule_config.log && schedule_config.log.path){
        let { params: logparams } = _this.getParams(schedule_action, task, task_params, schedule_config);
        logparams.schedule_task_id = task.schedule_task_id;
        schedule_task_log = schedule_config.log.path.toString();
        schedule_task_log = Helper.ReplaceParams(schedule_task_log, logparams);
        task.schedule_task_log = schedule_task_log;
      }

      //Parse action
      var schedule_action_str = (task.schedule_action || '').toString().trim();
      var schedule_action = {};
      try{
        if(schedule_action_str) schedule_action = JSON.parse(schedule_action_str);
      }
      catch(ex){
        schedule_action = schedule_action_str;
      }
      
      let sql = "update {schema}.schedule_task set schedule_task_rslt='RUNNING', schedule_task_log=@schedule_task_log where schedule_task_id=@schedule_task_id;";
      var sql_ptypes = [dbtypes.BigInt, dbtypes.VarChar(dbtypes.MAX)];
      var sql_params = { schedule_task_id: task.schedule_task_id, schedule_task_log: schedule_task_log };
      appsrv.ExecScalar('scheduler', module.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
        if(err){ _this.taskLog.error(task, err); return callback(); }

        if(task.schedule_action_type=='JOB'){
          return _this.execTaskJob(schedule_action, task, task_params, schedule_config, callback);
        }
        else if(task.schedule_action_type=='TASK'){
          return _this.execTaskTask(schedule_action, task, task_params, schedule_config, callback);
        }
        else if(task.schedule_action_type=='SQL'){
          return _this.execTaskSql(schedule_action, task, task_params, schedule_config, callback);
        }
        else if(task.schedule_action_type=='JS'){
          return _this.execTaskJS(schedule_action, task, task_params, schedule_config, callback);
        }
        else{
          return callback('Action type not supported');
        }
      });
    });
  };

  _this.getParams = function(action, task, task_params, schedule_config){
    var paramtypes = { schedule_task_id: jsh.AppSrv.DB.types.BigInt }; //dbtypes.BigInt, dbtypes.BigInt, dbtypes.DateTime(7), dbtypes.VarChar(dbtypes.MAX)
    var params = { schedule_task_id: task.schedule_task_id };

    //Search fields for type
    _.each((schedule_config && schedule_config.fields), function(field){
      if(field.name){
        params[field.name] = ('default' in field) ? field.default : null;
        if(field.type) paramtypes[field.name] = jsh.AppSrv.getDBType(field);
      }
    });
    for(let key in task_params){
      params[key] = task_params[key];
    }
    var ptypes = [];
    for(let key in params){
      if(key in paramtypes) ptypes.push(paramtypes[key]);
      else ptypes.push(jsh.AppSrv.DB.types.fromValue(params[key]));
    }
    return { ptypes, params };
  };

  _this.taskLog = function(task, loglevel, msg){
    var logParams = undefined;
    if(task.schedule_task_log){
      var logfile = task.schedule_task_log;
      if(!path.isAbsolute(logfile)) logfile = path.join(jsh.Config.logdir, logfile);
      logParams = { logfile: logfile };
    }
    jsh.Log[loglevel](msg, logParams);
  };
  _this.taskLog.info = function(task, msg){ return _this.taskLog(task, 'info', msg); };
  _this.taskLog.warning = function(task, msg){ return _this.taskLog(task, 'warning', msg); };
  _this.taskLog.error = function(task, msg){ return _this.taskLog(task, 'error', msg); };

  _this.execTaskBase = function(action, task, task_params, schedule_config, callback, op){
    _this.taskLog.info(task, 'Scheduled Task '+task.schedule_name+' #'+task.schedule_task_id+' started');
    
    var { ptypes, params } = _this.getParams(action, task, task_params, schedule_config);
    var schedule_timeout = parseInt(task.schedule_timeout||0) * 1000;
    var timedOut = false;
    var schedule_timer = null;
    if(schedule_timeout>=0){
      schedule_timer = setTimeout(function(){
        if(!schedule_timer) return;
        schedule_timer = null;
        timedOut = true;
        var errmsg = 'Scheduled Task '+task.schedule_name+' #'+task.schedule_task_id+' timed out.  Background operations may still be in progress';
        _this.taskLog.error(task, errmsg);
        _this.resultTaskFail(task, errmsg, callback);
      }, schedule_timeout);
    }
    op(ptypes, params, function(err, schedule_task_summary){
      if(schedule_timer){
        clearTimeout(schedule_timer);
        schedule_timer = null;
      }
      if(timedOut){ _this.taskLog.error(task, 'Scheduled Task '+task.schedule_name+' #'+task.schedule_task_id+' DB operation returned after timeout'); return; }
      if(err){
        _this.taskLog.error(task, err);
        _this.resultTaskFail(task, err.toString(), callback);
      }
      else {
        _this.resultTaskSuccess(task, schedule_task_summary, callback);
      }
    });
  };

  _this.execTaskJob = function(action, task, task_params, schedule_config, callback){
    //action: {
    //  "job_source": "MAIN", "job_action": "REPORT", "job_action_target": "{Name of Report or Task}", "job_params": {"key": "value"},
    //  "doc_scope": "C", "doc_scope_id": "5", "doc_ctgr": "DOCUMENT", "doc_desc": "Sample Report",
    //  "queue_name": "PRT1", "queue_message": "A1234",
    //  "email_to": "john@acme.com", "email_cc": "john@acme.com", "email_bcc": "john@acme.com", "email_attach": "filename:report.zip", "email_doc_id": "5",
    //    "email_txt_attrib": "FORGOTPASSWORD",
    //    "email_subject": "Subject Line",  "email_text": "Text Version",  "email_html": "<b>HTML</b> Version",
    //  "note_scope": "S", "note_scope_id": "6", "note_type": "S", "note_body": "Item created",
    //  "sms_to": "+12223334444",
    //    "sms_txt_attrib": "WELCOME",
    //    "sms_body": "A new report is available",
    //}
    if(_.isString(action)) action = {
      job_source: 'MAIN',
      job_action: 'REPORT',
      job_action_target: action
    };
    _this.execTaskBase(action, task, task_params, schedule_config, callback, function op(ptypes, params, op_cb){
      if(!action || !action.job_action_target) return op_cb(new Error('Action missing job_action_target parameter'));
      var job = _.extend({
        job_source: 'MAIN',
        job_action: 'REPORT',
      }, action);

      job.job_params = _.extend({}, job.job_params, params);
      if(job.job_action_target && ('schedule_task_id' in job.job_params)){
        var model = jsh.getModel(null, job.job_action_target);
        var fieldlist = jsh.AppSrv.getFieldNames(null, model.fields, 'B');
        if(!_.includes(fieldlist, 'schedule_task_id')) delete job.job_params.schedule_task_id;
      }


      var jobtasks = {};
      jsh.AppSrv.JobProc.AddDBJobBase('scheduler', jobtasks, 'newjob', job, job.job_action_target, job.job_params||{}, function(err){
        if(err) return op_cb(err);

        jsh.AppSrv.JobProc.db.ExecTransTasks(jobtasks, function (err, rslt, stats) {
          if (err != null) { return op_cb(err); }
          var job_id = null;
          if(rslt && rslt.newjob) job_id = parseInt(rslt.newjob);
          if(!job_id) return op_cb(new Error('Job ID not returned'));
          //Wait for job to complete
          var waitForJobComplete = function(sts_cb){
            jsh.AppSrv.ExecRecordset('scheduler', 'jobproc_getresult', [jsh.AppSrv.DB.types.BigInt], { job_id: job_id }, function (err, rslt) {
              if(err) return sts_cb(err);
              if(!rslt || !rslt[0] || !rslt[0].length || !rslt[0][0]) return sts_cb(new Error('Job not found'));
              rslt = rslt[0][0];
              if(!rslt.job_rslt) return setTimeout(function(){ waitForJobComplete(sts_cb); }, 500);
              return sts_cb(null, rslt);
            });
          };
          waitForJobComplete(function(err, rslt){
            if(err) return op_cb(err);
            if(rslt.job_rslt == 'OK') return op_cb();
            return op_cb(new Error('Job #'+job_id+' failed: '+rslt.job_snotes));
          });
        });
      });
    });

  };

  _this.execTaskTask = function(action, task, task_params, schedule_config, callback){
    //action: { "task": "sample_task" }
    if(_.isString(action)) action = { task: action };
    _this.execTaskBase(action, task, task_params, schedule_config, callback, function op(ptypes, params, op_cb){
      if(!action || !action.task) return op_cb(new Error('Action missing task parameter'));
      jsh.AppSrv.tasksrv.exec(undefined, undefined, undefined, action.task, params, function(err, taskrslt){
        return op_cb(err);
      });
    });
  };

  _this.execTaskSql = function(action, task, task_params, schedule_config, callback){
    //action: { "sql": "select * from table where col=@param1" }
    if(_.isString(action)) action = { sql: action };
    _this.execTaskBase(action, task, task_params, schedule_config, callback, function op(ptypes, params, op_cb){
      if(!action || !action.sql) return op_cb(new Error('Action missing sql parameter'));
      jsh.AppSrv.ExecMultiRecordset('scheduler', module.replaceSchema(action.sql), ptypes, params, function (err, rslt) {
        var schedule_task_summary = null;
        if(rslt && rslt.length && rslt[0] && rslt[0].length){
          _.each(rslt[0], function(rs){
            if(rs && rs.length && rs[0]){
              var row = rs[0];
              for(var key in row){
                if(key.toLowerCase()=='schedule_task_summary'){
                  schedule_task_summary = row[key];
                }
              }
            }
          });
        }
        return op_cb(err, schedule_task_summary);
      });
    });
  };

  _this.execTaskJS = function(action, task, task_params, schedule_config, callback){
    //action: { "js": "console.log('test');" }
    //action: {"js": "return new Promise(function(resolve,reject){ resolve({ rslt: 'success'}); });" }
    if(_.isString(action)) action = { js: action };
    _this.execTaskBase(action, task, task_params, schedule_config, callback, function op(ptypes, params, op_cb){
      if(!action || !action.js) return op_cb(new Error('Action missing js parameter'));

      var varstr = '';
      for(var key in params){
        varstr += 'var key = '+JSON.stringify(params[key])+';';
      }
      var jsstr = '(function(){ ' + varstr + action.js + ' })();';
      var jsrslt = null;
      try{
        jsrslt = eval(jsstr);
      }
      catch(ex){
        _this.taskLog.error(task, 'Error executing: '+jsstr);
        if(ex) return op_cb(ex);
      }

      Helper.execif((jsrslt && jsrslt.then && jsrslt.catch),
        function(f){
          jsrslt
            .then(function(rslt){ jsrslt = rslt; f(); })
            .catch(function(err){ return op_cb(err); });
        },
        function(){
          var schedule_task_summary = null;
          if(jsrslt && ('schedule_task_summary' in jsrslt)) schedule_task_summary = jsrslt.schedule_task_summary;
          return op_cb(null, schedule_task_summary);
        }
      );
    });
  };

  _this.resultTaskSuccess = function(task, schedule_task_summary, callback){
    _this.taskLog.info(task, 'Scheduled Task '+task.schedule_name+' #'+task.schedule_task_id+' complete');
    return _this.resultTask(task, true, schedule_task_summary, null, callback);
  };

  _this.resultTaskFail = function(task, rslt_desc, callback){
    _this.taskLog.error(task, 'Scheduled Task '+task.schedule_name+' #'+task.schedule_task_id+' failed: '+rslt_desc);
    return _this.resultTask(task, false, null, rslt_desc, callback);
  };

  _this.resultTask = function(task, isSuccess, schedule_task_summary, rslt_desc, callback){
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var schedule_following_tstmp = _this.getNextDate(task);
    if(!schedule_following_tstmp) schedule_following_tstmp = null;
    if(typeof schedule_task_summary == 'undefined') schedule_task_summary = null;
    if(!Helper.isNullUndefined(schedule_task_summary)) schedule_task_summary = schedule_task_summary.toString();
    let sql = '';
    if(isSuccess){
      sql = [
        "update {schema}.schedule_task set schedule_task_rslt = 'SUCCESS', schedule_task_summary = @schedule_task_summary where schedule_task_id = @schedule_task_id;",
        'update {schema}.schedule set schedule_next_tstmp=@schedule_next_tstmp where schedule_id = @schedule_id;',
      ].join(' ');
    }
    else {
      sql = [
        "update {schema}.schedule_task set schedule_task_rslt = 'FAIL', schedule_task_rslt_desc = @schedule_task_rslt_desc where schedule_task_id = @schedule_task_id;"
      ].join(' ');
    }
    var sql_ptypes = [dbtypes.BigInt, dbtypes.BigInt, dbtypes.DateTime(7), dbtypes.VarChar(dbtypes.MAX), dbtypes.VarChar(dbtypes.MAX)];
    var sql_params = { schedule_task_id: task.schedule_task_id, schedule_id: task.schedule_id, schedule_next_tstmp: schedule_following_tstmp, schedule_task_rslt_desc: rslt_desc || null, schedule_task_summary: schedule_task_summary };
    appsrv.ExecScalar('scheduler', module.replaceSchema(sql), sql_ptypes, sql_params, function (err, rslt) {
      if(err){ _this.taskLog.error(task, err); return callback(); }
      return callback();
    });
  };

};
