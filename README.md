# ======================
# jsharmony-scheduler
# ======================

Scheduler for jsharmony-factory projects

## Installation

npm install jsharmony-scheduler --save

## Initial Configuration

Add to your config file
```
var jsHarmonyScheduler = require('jsharmony-scheduler');

....

  jsh.AddModule(new jsHarmonyScheduler());

  var configScheduler = config.modules['jsHarmonyScheduler'];
  if (configScheduler) {
    configScheduler.disabled = false;  //Disable the scheduler
    configScheduler.checkDelay = 1000;  //Time between checks for new jobs
  }
```

If you are adding to an existing site, initialize the DB Scripts for the jsHarmony Scheduler module and restart the service.

Add tasks to the Scheduler administration under the Dev panel.