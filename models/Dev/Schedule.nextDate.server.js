/* globals callback, sql_params, sql_rslt, require, jsh */
//callback, req, res, sql_params, sql_rslt, require, jsh, modelid
var schedule_id = sql_params.schedule_id;
if(!schedule_id) schedule_id = sql_rslt.schedule_id;
if(!schedule_id) return callback();

//Get next date
jsh.Modules['jsHarmonyScheduler'].controller.checkSchedule(function(err, task){
  return callback();
}, { schedule_id: schedule_id });