const fsMock = require('mock-fs'),
  hc = require('../health-checker'),
  _ = require('lodash'),
  {assert} = require('chai'),
  P = require('bluebird')

const versionJson = {
  commit: 'd224ae7d9d35fcf9d8d3dbe53b985e1bb6b18ea9',
  commitDate: '2017-06-05T08:50:13+03:00',
  releaseDate: '2018-06-05T08:50:13+03:00'
}

describe('health-check-test', function () {

  describe('single checks', function () {
    it('success has ping and version.json information', async function () {
      fsMock({
        'version.json' : JSON.stringify(versionJson)
      })

      hc.configure({test: () => {}}, null, {versionFile: 'version.json'})
      const results = await hc.runHealthChecks()
      assert.ok(_.isNumber(results.ping.test))
      assert.ok(results.ping.test < 100)
      assert.isUndefined(results.details)
      assert.deepEqual(results.version, versionJson)
      fsMock.restore()
    })

    it('success has ping and no version info if version.json not found', async function () {
      hc.configure({
        test: () => {
        }
      })
      const results = await hc.runHealthChecks()
      assert.ok(_.isNumber(results.ping.test))
      assert.ok(results.ping.test < 100)
      assert.isUndefined(results.version)
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
      }, {}, {timeout: 100})
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

    it('integration checks provide detailed message and versions', async function () {
      fsMock({
        'version.json' : JSON.stringify(versionJson)
      })
      hc.configure(null, {
          test1: () => ({details: 'oh my1', version: {commit: 'SHA1', releaseDate: 'date', foo: 'bar'}}),
          test2: () => ({details: 'oh my2', version: {commit: 'SHA2'}}),
          test3: () => ({details: 'oh my3', version: {foo: 'SHA3'}}),
          test4: () => ({details: 'oh my4'}),
          test5: () => ({version: {commit: 'SHA5'}})
        },
        null,
        'version.json')
      const results = await hc.runHealthChecks()
      console.log(results)
      assert.equal(results.details.test1, 'oh my1')
      assert.deepEqual(results.dependencies.test1, {commit: 'SHA1', releaseDate: 'date', foo: 'bar'})

      assert.equal(results.details.test2, 'oh my2')
      assert.deepEqual(results.dependencies.test2, {commit: 'SHA2'})

      assert.equal(results.details.test3, 'oh my3')
      assert.deepEqual(results.dependencies.test3, {foo: 'SHA3'})

      assert.equal(results.details.test4, 'oh my4')
      assert.isUndefined(results.dependencies.test4)

      assert.deepEqual(results.dependencies.test5, {commit: 'SHA5'})
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
      }, {}, {timeout: 200})
      const results = await hc.runHealthChecks()
      assert.equal(results.failures.length, 1)
      assert.ok(!results.success)
    })
  })
})
