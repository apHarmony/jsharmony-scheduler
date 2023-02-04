jsh.App[modelid] = new (function(){
  var _this = this;

  _this.onload = function(){
    //Load API Data
    this.loadData();
  };

  _this.loadData = function(){
    var emodelid = jsh._BASEURL+'_funcs/jsHarmonyScheduler/schedule_task_log/'+xmodel.get('schedule_task_id');
    XForm.Get(emodelid, { }, { }, function (rslt) { //On Success
      if ('_success' in rslt) {
        //Render Log
        if(!(rslt.log||'').trim()){
          $('#'+xmodel.class+'_log').html('-----------');
        }
        else {
          $('#'+xmodel.class+'_log').html(XExt.escapeHTMLBR(rslt.log));
        }
      }
      else XExt.Alert('Error while loading data');
    });
  };

})();