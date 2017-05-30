const express = require('express'),
  hc = require('../health-checker'),
  requestPromise = require('request-promise'),
  {assert} = require('chai'),
  P = require('bluebird')

describe('express-test', function () {
  it('health checker can be instructed to embed itself in express', async function () {
    hc.configure({
      test: function () {
      }
    })
    const app = express()

    hc.setupExpressRoutes(app)

    const server = await app.listen(4075)
    try {
      const response = await requestPromise('http://localhost:4075/health', {json: true})
      assert.ok(response.success)
    } finally {
      server.close()
    }
  })

  it('a custom path prefix can be used', async function () {
    hc.configure({
      test: function () {
      }
    })
    const app = express()

    hc.setupExpressRoutes(app, '/lemonade')

    const server = await app.listen(4075)
    try {
      const response = await requestPromise('http://localhost:4075/lemonade/health', {json: true})
      assert.ok(response.success)
    } finally {
      server.close()
    }
  })

  it('custom middleware can be provided', async function () {
    hc.configure({
      test: function () {
      }
    })
    const app = express()

    hc.setupExpressRoutes(app, undefined, (req, res, next) => {
      res.status(545)
      res.send({fail: true})
    })

    const server = await app.listen(4075)
    try {
      const response = await requestPromise('http://localhost:4075/health', {json: true})
      throw new Error('Should have failed')
    } catch (err) {
      if (!err.statusCode) throw err
      assert.equal(err.statusCode, 545)
    } finally {
      server.close()
    }
  })

  it('it is possible to only run internal checks', async function () {
    hc.configure({
        intern: async () => await P.delay(50)
      },
      {
        integr: async () => await P.delay(50)
      }
    )
    const app = express()

    hc.setupExpressRoutes(app)

    const server = await app.listen(4075)
    try {
      const response = await requestPromise('http://localhost:4075/health/internal', {json: true})
      console.log(response)
      assert.ok(response.ping.intern)
      assert.ok(!response.ping.integr)
    } finally {
      server.close()
    }
  })
})