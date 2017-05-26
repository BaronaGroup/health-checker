'use strict'

const P = require('bluebird'),
  _ = require('lodash')

let configuration = {}

exports.configure = function (internalChecks, integrationChecks) {
  configuration = {
    internalChecks: prepareChecksOfType('internal', internalChecks),
    integrationChecks: prepareChecksOfType('integration', integrationChecks)
  }
}

exports.setupExpressRoutes = function (app, prefix, additionalMiddleware) {
  app.get((prefix || '') + '/health/:mode?', disableCache, additionalMiddleware || noopMiddleware, exports.expressHealthCheck)
}

exports.expressHealthCheck = function (req, res, next) {
  const internalOnly = req.params.mode === 'internal' || req.query.mode === 'internal' || req.query.internal

  const healthChecks = configuration.internalChecks.concat(internalOnly ? [] : configuration.integrationChecks)

  checkHealth(healthChecks)
    .then(function (results) {
      if (!results.success) res.status(500)
      res.send(results)
    })
    .catch(next)
}

function checkHealth(checks) {
  return P.all(checks.map(checkSingleHealth))
    .then(function (results) {
      const success = results.every(result => result.success),
        successfulChecks = results.filter(result => result.success),
        ping = _.fromPairs(successfulChecks.map(result => [result.service, result.duration])),
        details = _.fromPairs(successfulChecks.filter(check => check.details).map(check => [check.service, check.details]))

      let failures = results.filter(result => !result.success).map(result => ({
        type: result.type,
        service: result.service,
        message: result.message,
        isTimeout: result.isTimeout
      }))
      return {
        success,
        failures: failures.length ? failures : undefined,
        ping,
        details: Object.keys(details).length ? details : undefined
      }
    })

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
    run: (check.apply ? check : check.run) || canNotRun
  }
}

function checkSingleHealth(check) {
  const dateAtStart = new Date().valueOf()
  const baseOutput = {service: check.service, type: check.type}
  return P.try(() => check.run()).timeout(check.timeout || 5000)
    .then(function (result) {
      const duration = new Date().valueOf() - dateAtStart
      return Object.assign(baseOutput, {success: true, duration})
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
