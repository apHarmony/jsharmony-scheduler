var rrule = require('rrule');
var assert = require('assert');
var jsHarmonySchedulerController = new (require('../jsHarmonySchedulerController.js'))({ jsh: null });

describe('RRULE', function(){
  it('Daily', function(){
    var task = {
      schedule_start_tstmp: '2023-01-01',
      schedule_rrule: 'FREQ=DAILY;BYDAY=MO,TU,WE;BYHOUR=9,10,11;INTERVAL=1',
    }
    var fromDate = new Date('2023-02-01 11:30:00');
    var rulestr =
      'DTSTART:' + jsHarmonySchedulerController.dateAddUTCOffset(task.schedule_start_tstmp).format('YYYYMMDDTHHmmss')+'Z'+
      (task.schedule_rrule ? '\nRRULE:' + task.schedule_rrule : '\nRRULE:COUNT=1')+
      (task.schedule_rdate ? '\nRDATE' + ((task.schedule_rdate.indexOf(':')>=0)?';':':') + task.schedule_rdate : '')+
      (task.schedule_exrule ? '\nEXRULE:' + task.schedule_exrule : '')+
      (task.schedule_exdate ? '\nEXDATE' + ((task.schedule_exdate.indexOf(':')>=0)?';':':') + task.schedule_exdate : '');
    var rule = rrule.rrulestr(rulestr);
    var nextDate = rule.after(jsHarmonySchedulerController.dateAddUTCOffset(fromDate).toDate());
    assert(nextDate.toISOString()=='2023-02-06T09:00:00.000Z');
  });
});