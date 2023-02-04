var fs = require('fs');
var Helper = require('jsharmony/Helper');
var path = require('path');

module.exports = exports = function(module){

  var exports = {};
  
  exports.schedule_task_log = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = {};
    if (req.body && ('data' in req.body)){
      try{ P = JSON.parse(req.body.data); }
      catch(ex){ Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    }
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Admin/ScheduleTask');

    if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

    var schedule_task_id = req.params.schedule_task_id;
    if(!schedule_task_id) return next();
    if(schedule_task_id.toString() != parseInt(schedule_task_id).toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters');

    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    var sql = 'select schedule_task_id, schedule_task_log from {schema}.schedule_task inner join {schema}.schedule on schedule.schedule_id = schedule_task.schedule_id where schedule_task_id=@schedule_task_id';
    appsrv.ExecRow(req._DBContext, module.replaceSchema(sql), [dbtypes.BigInt], { schedule_task_id: schedule_task_id }, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt[0]) return Helper.GenError(req, res, -99999, 'Invalid Task ID');
      var schedule_task_log = (rslt[0].schedule_task_log || '').toString().trim();

      if (verb == 'get') {
        var logpath = schedule_task_log;
        if(!logpath) return res.end(JSON.stringify({ '_success': 1, log: '' }));
        if(!path.isAbsolute(logpath)) logpath = path.join(module.jsh.Config.logdir, logpath);
        
        var log = '';
        fs.exists(logpath, function(exists){
          Helper.execif(exists,
            function(f){
              fs.readFile(logpath, 'utf8', function(err, data){
                if(err) return f();
                log = data;
                return f();
              });
            },
            function(){
              res.end(JSON.stringify({ '_success': 1, log: log }));
            }
          );
        });
        return;
      }
      return next();
    });
  };

  exports.schedule_upcoming = function (req, res, next) {
    var verb = req.method.toLowerCase();
    if (!req.body) req.body = {};

    var Q = req.query;
    var P = {};
    if (req.body && ('data' in req.body)){
      try{ P = JSON.parse(req.body.data); }
      catch(ex){ Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    }
    var jsh = module.jsh;
    var appsrv = jsh.AppSrv;
    var dbtypes = appsrv.DB.types;

    var model = jsh.getModel(req, module.namespace + 'Dev/Schedule');

    if (!appsrv.ParamCheck('P', P, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }
    if (!appsrv.ParamCheck('Q', Q, [])) { Helper.GenError(req, res, -4, 'Invalid Parameters'); return; }

    var schedule_id = req.params.schedule_id;
    if(!schedule_id) return next();
    if(schedule_id.toString() != parseInt(schedule_id).toString()) return Helper.GenError(req, res, -4, 'Invalid Parameters');

    if (!Helper.hasModelAction(req, model, 'B')) { Helper.GenError(req, res, -11, 'Invalid Model Access'); return; }

    var sql = 'select schedule_id from {schema}.schedule where schedule_id=@schedule_id';
    appsrv.ExecRow(req._DBContext, module.replaceSchema(sql), [dbtypes.BigInt], { schedule_id: schedule_id }, function (err, rslt) {
      if (err != null) { err.sql = sql; err.model = model; appsrv.AppDBError(req, res, err); return; }
      if(!rslt || !rslt[0]) return Helper.GenError(req, res, -99999, 'Invalid Schedule ID');
      //var schedule_task_log = (rslt[0].schedule_task_log || '').toString().trim();

      if (verb == 'get') {
        module.controller.getUpcoming(schedule_id, 100, function(err, upcoming_dates){
          if(err) return Helper.GenError(req, res, -99999, err.toString());
          return res.end(JSON.stringify({ '_success': 1, upcoming: upcoming_dates }));
        });
        return;
      }
      return next();
    });
  };

  return exports;
};
