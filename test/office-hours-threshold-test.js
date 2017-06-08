const hc = require('../health-checker'),
  {assert} = require('chai')

describe('office hours threshold test', function () {
  let now,
    lastOccurence,
    defaultGetNowImpl
  before(mockNow)
  after(unmockNow)

  const longTimeAgo = new Date('2000-01-01T00:00:00.000+0300')

  describe('with a predefined threshold', function () {
    before(function() {
      hc.configure({
        test: hc.officeHoursActivityThreshold(() => lastOccurence, 30)
      })
    })

    describe('threshold is ignored', function () {
      it('during weekends', async function() {
        lastOccurence = longTimeAgo
        now = new Date('2017-05-27T12:12:12.000+0300')
        assert.equal(now.getDay(), 6)

        const response = await hc.runHealthChecks()
        assert.ok(response.success)
        assert.ok(response.details.test.threshold.tolerated)
      })

      it('before 9 am', async function() {
        lastOccurence = longTimeAgo
        now = new Date('2017-05-24T08:45:00.000+0300')
        assert.equal(now.getDay(), 3)

        const response = await hc.runHealthChecks()
        assert.ok(response.success)
        assert.ok(response.details.test.threshold.tolerated)
      })

      it('after 5 pm', async function() {
        lastOccurence = longTimeAgo
        now = new Date('2017-05-24T17:15:00.000+0300')
        assert.equal(now.getDay(), 3)

        const response = await hc.runHealthChecks()
        assert.ok(response.success)
        assert.ok(response.details.test.threshold.tolerated)
      })
    })

    describe('within window', function () {
      it('details are provided even if there is no error', async function() {
        now = new Date('2017-05-24T12:12:12.000+0300')
        lastOccurence = new Date('2017-05-24T12:02:12.000+0300')

        const response = await hc.runHealthChecks()
        assert.ok(response.success)
        assert.ok(response.details.test.threshold.maxMinutesSinceLastEvent, 30)
        assert.ok(response.details.test.threshold.minutesSinceLastEvent, 10)
      })

      it('recent enough events result in success', async function() {
        lastOccurence = now = new Date('2017-05-24T12:02:12.000+0300')

        const response = await hc.runHealthChecks()
        assert.ok(response.success)
      })

      it('no recent enough events results in failure', async function() {
        now = new Date('2017-05-24T12:02:12.000+0300')
        lastOccurence = longTimeAgo

        const response = await hc.runHealthChecks()
        assert.ok(!response.success)
      })

      it('having no last occurence equals too long ago', async function() {
        now = new Date('2017-05-24T12:02:12.000+0300')
        lastOccurence = undefined

        const response = await hc.runHealthChecks()
        assert.ok(!response.success)
      })
    })
  })
  it('threshold is configurable')

  function mockNow() {
    defaultGetNowImpl = hc.getNow
    hc.getNow = () => new Date(now)
  }

  function unmockNow() {
    hc.getNow = defaultGetNowImpl
  }
})
