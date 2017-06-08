'use strict'

const P = require('bluebird'),
  _ = require('lodash'),
  path = require('path'),
  fs = P.promisifyAll(require('fs'))

let configuration = {}

exports.getNow = () => new Date() // exposed for tests
const getNow = () => exports.getNow()

exports.configure = function (internalChecks, integrationChecks, options) {
  const opts = options || {}
  configuration = {
    internalChecks: prepareChecksOfType('internal', internalChecks),
    integrationChecks: prepareChecksOfType('integration', integrationChecks),
    timeout: opts.timeout || 5000,
    version: readVersionJson(opts.versionFile)
  }
}

exports.setupExpressRoutes = function (app, prefix, additionalMiddleware) {
  app.get((prefix || '') + '/health/:mode?', disableCache, additionalMiddleware || noopMiddleware, exports.expressHealthCheck)
}

exports.expressHealthCheck = function (req, res, next) {
  const internalOnly = req.params.mode === 'internal' || req.query.mode === 'internal' || req.query.internal

  exports.runHealthChecks(internalOnly)
    .then(function (results) {
      if (!results.success) res.status(500)
      res.send(results)
    })
    .catch(next)
}

exports.runHealthChecks = function(internalOnly) {
  const healthChecks = configuration.internalChecks.concat(internalOnly ? [] : configuration.integrationChecks)
  return checkHealth(healthChecks)
}

exports.officeHoursActivityThreshold = function (getLastOccurrence, thresholdMinutes) {
  return function() {
    const startForToday = getNow()
    startForToday.setHours(9)
    startForToday.setMinutes(0)
    startForToday.setSeconds(0)
    startForToday.setMilliseconds(0)

    const endForToday = getNow()
    endForToday.setHours(17)
    endForToday.setMinutes(0)
    endForToday.setSeconds(0)
    endForToday.setMilliseconds(0)

    const now = getNow(),
      isWeekend = now.getDay() === 0 || now.getDay() === 6,
      isOfficeHours = !isWeekend && now >= startForToday && now <= endForToday, // TODO: add a thingamajig to prevent holidays from triggering health check failures
      lastOccurrence = getLastOccurrence(),
      minsSinceLastOccurence = lastOccurrence ? Math.floor((now.valueOf() - lastOccurrence.valueOf()) / 1000 / 60) : Infinity,
      isTooLongSince = minsSinceLastOccurence > thresholdMinutes,
      isFailure = isTooLongSince && isOfficeHours

    const details = {
      threshold: {
        maxMinutesSinceLastEvent: thresholdMinutes,
        minutesSinceLastEvent: minsSinceLastOccurence,
        tolerated: isTooLongSince && !isOfficeHours ? 'tolerated because outside office hours' : undefined
      }
    }

    if (isFailure) {
      const error = new Error('Too long since last event; ' + JSON.stringify(details))
      return P.reject(error)
    } else {
      return P.resolve({details: details})
    }
  }
}

function checkHealth(checks) {
  return P.all(checks.map(checkSingleHealth))
    .then(function (results) {
      const success = results.every(result => result.success),
        successfulChecks = results.filter(result => result.success),
        ping = _.fromPairs(successfulChecks.map(result => [result.service, result.duration])),
        details = _.fromPairs(successfulChecks.filter(result => result.details).map(check => [check.service, check.details])),
        dependencies = _.fromPairs(successfulChecks.filter(result => result.version).map(check => [check.service, check.version]))

      let failures = results.filter(result => !result.success).map(result => ({
        type: result.type,
        service: result.service,
        message: result.message,
        isTimeout: result.isTimeout,
        version: result.type !== 'internal' ? result.version : undefined
      }))
      return {
        success,
        failures: failures.length ? failures : undefined,
        ping,
        dependencies,
        details: Object.keys(details).length ? details : undefined,
        version: configuration.version
      }
    })

}

function readVersionJson(versionFile) {
  if (versionFile) {
    return fs.existsSync(versionFile) ? JSON.parse(fs.readFileSync(versionFile, 'utf8')) : undefined
  } else {
    return undefined
  }
}

function prepareChecksOfType(type, checks) {
  if (!checks) return []
  if (_.isArray(checks)) {
    return _.compact(checks).map(check => prepareCheck(check, {type}))
  } else {
    return _.compact(_.toPairs(checks)
      .map(function (serviceAndCheck) {
        const service = serviceAndCheck[0],
          check = serviceAndCheck[1]
        return prepareCheck(check, {type, service})
      }))
  }
}

function prepareCheck(check, suggestions) {
  if (!check) return null
  return {
    service: suggestions.service || check.name || 'unspecified',
    type: check.type || suggestions.type,
    run: (check.apply ? check : check.run) || canNotRun,
    timeout: check.timeout
  }
}

function checkSingleHealth(check) {
  const dateAtStart = new Date().valueOf()
  const baseOutput = {service: check.service, type: check.type}
  return P.try(() => check.run()).timeout(check.timeout || configuration.timeout)
    .then(function (result) {
      const duration = new Date().valueOf() - dateAtStart
      return Object.assign(baseOutput, {success: true, duration, details: result && result.details, version: result && result.version})
    }, function (err) {
      if (err instanceof P.TimeoutError) {
        return Object.assign(baseOutput, {success: false, isTimeout: true})
      } else {
        return Object.assign(baseOutput, {success: false, message: err.message || err})
      }
    })
}

function noopMiddleware(req, res, next) {
  next()
}


function disableCache(req, res, next) {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  next()
}

function canNotRun() {
  throw new Error('Non-executable implementation')
}
