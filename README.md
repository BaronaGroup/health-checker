# Health Checker

primarily for use in Barona Technologies node.js code bases, with the intent of providing consistent
output regardless of application.

## Installation

Start with something along the lines of

    npm install --save git://github.com/BaronaGroup/health-checker#master
  
you might want to replace `master` with a specific commit hash though, you wouldn't 
want to have your health check fail because of unexpected updates.
 
## Configuration

    const healthChecker = require('health-checker')
    healthChecker.configure(internalHealthChecks, integrationHealthChecks, timeout = 5000)
   
### Setting up express route

All examples expect `app` to be your express app. 

"I just want to have my health check at /health"

    healthChecker.setupExpressRoutes(app)
    
Customizing the route (health check available at /api/health):
    
    healthChecker.setupExpressRoutes(app, '/api')

Including custom middleware (for authentication, for example)

    healthChecker.setupExpressRoute(app, undefined, myMiddleware)
   
   
## Setting up health checks
   
### Sets
   
Health checks are set up as two sets of checks -- internal checks, and integration checks.
Internal checks are meant to be used for things like database connectivity, verifying that
internal processes are happening as expected, and so on. Integration checks are meant to give
an overview of if integrations can be expected to be working.

Either set can be either an array, or a object that maps the check (service) name to
the check definition.
 
    const healthChecks = [check1, check2]
    // or
    const healthChecks = {
      check1: check1,
      check2: check2
    }
    
### Individual health checks
 
A single health check can be either just a function, or an object. In either case, these properties
are used from the check, if present

- name, unless it was provided though the key in the health check set
- type, which defaults to either internal or integration depending on the containing set
- timeout, which defaults to the overall health check timeout.
- run, unless the check itself is a function; this is what will be run for the health check
 
### Implementing a health check

A health check is a function, which indicates whether or not the component it is checking
seems to be functioning properly.

The function can be either synchronous, or asynchronous using promises. Async functions of course
work as well.

The way the health check indicates a failure is by throwing an exception, or having the promise
it returned be rejected. Successful completion of the function or resolution of the promise stands
for success.

Failures include a "message" field, which is filled by the cause of the failure. If the cause has a
 "message" field, it is used, otherwise the entire cause is.
 
Successful checks can also add additional details to the output of the health check. This is done by
returning an object with the key "details"; whatever it contains, will be included in the details.

### Events commonly occurring during office hours

Sometimes it just so happens that the only way to see if things are working properly is by seeing
if events that are supposed to happen regularily happen. Sometimes these events only occur because
of user actions, possibly users working at an office, which means that at night they might no happen
at all.

In order to help with this particular problem, this library includes the health checker utility
`officeHoursActivityThreshold`. 

The basic pattern of how to use is more or less this

    healthChecker.configure({
        myCheck: healthChecker.officeHoursActivityThreshold(() => theMostRecentOccurence, thresholdMins)
    })
    
The return value of `officeHoursActivityThreshold` itself is used as a health check. The function has two
parameters, the first one is a function, which should (synchronously) return the date of the last occurence 
of the event being monitored, and the second is the threshold for how many minutes of inactivity is enough
to cause health check failure.

The health checks generated using this function fail when there has been more than `thresholdMins` between
the most recent occurence and the current time, but only if the current time fulfills the following criteria:
- it is monday, tuesday, wednesday, thursday or friday
- it is between 9 am and 5 pm