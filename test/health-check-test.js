const hc = require('../health-checker'),
  _ = require('lodash'),
  {assert} = require('chai'),
  P = require('bluebird')

describe('health-check-test', function () {
  describe('single checks', function () {
    it('success has ping', async function () {
      hc.configure({
        test: () => {
        }
      })
      const results = await hc.runHealthChecks()
      assert.ok(_.isNumber(results.ping.test))
      assert.ok(results.ping.test < 100)
    })

    it('checks can be asynchronous (success)', async function () {
      hc.configure({
        test: () => P.delay(100)
      })
      const results = await hc.runHealthChecks()
      assert.ok(_.isNumber(results.ping.test))
      assert.ok(results.ping.test > 99)
      assert.ok(results.ping.test < 200)
    })

    it('synchronous failure', async function () {
      hc.configure({
        test: () => { throw new Error('No can do')}
      })
      const results = await hc.runHealthChecks()
      assert.ok(!results.success)
    })

    it('failure', async function () {
      hc.configure({
        test: async () => { throw new Error('No can do')}
      })
      const results = await hc.runHealthChecks()
      assert.ok(!results.success)
    })

    it('failure can provide message', async function () {
      hc.configure({
        test: () => { throw new Error('No can do')}
      })
      const results = await hc.runHealthChecks()
      assert.ok(!results.success)
      assert.equal(results.failures[0].service, 'test')
      assert.equal(results.failures[0].message, 'No can do')
    })

    it('timeout is a thing', async function() {
      hc.configure({
        test: () => P.delay(500)
      }, {}, 100)
      const results = await hc.runHealthChecks()
      assert.ok(!results.success)
      assert.ok(results.failures[0].isTimeout)
    })

    it('timeout can be specified on specific tests', async function() {
      hc.configure({
        test: { run: () => P.delay(250), timeout: 500 }
      }, {}, 100)
      const results = await hc.runHealthChecks()
      assert.ok(results.success)
    })

    it('checks can be asynchronous (failure)', async function () {
      hc.configure({
        test: async () => {
          await P.delay(100)
          throw new Error('Sorry mate')
        }
      })
      const results = await hc.runHealthChecks()
      assert.ok(!results.success)
      assert.equal(results.failures[0].message, 'Sorry mate')
    })

    it('success can provide details', async function () {
      hc.configure({
        test: () => ({details: 'oh my'})
      })
      const results = await hc.runHealthChecks()
      assert.equal(results.details.test, 'oh my')
    })


  })

  describe('multiple checks', function () {
    it('all successes means overall success', async function () {
      hc.configure({
        test1: async () => {},
        test2: async () => {},
        test3: async () => {}
      })
      const results = await hc.runHealthChecks()
      assert.isUndefined(results.failures)
      assert.ok(results.success)
    })

    it('any failure means overall failure', async function () {
      hc.configure({
        test1: async () => {},
        test2: async () => { throw new Error('F')},
        test3: async () => {}
      })
      const results = await hc.runHealthChecks()
      assert.equal(results.failures.length, 1)
      assert.ok(!results.success)
    })

    it('timeout works in combination with other results', async function () {
      hc.configure({
        test1: async () => {},
        test2: async () => { await P.delay(500)},
        test3: async () => {}
      }, {}, 200)
      const results = await hc.runHealthChecks()
      assert.equal(results.failures.length, 1)
      assert.ok(!results.success)
    })
  })
})