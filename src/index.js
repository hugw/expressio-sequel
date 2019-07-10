/**
 * Expressio Sequel
 *
 *
 * @copyright Copyright (c) 2019, hugw.io
 * @author Hugo W - contact@hugw.io
 * @license MIT
 */

import Joi from '@hapi/joi'
import ndtk from 'ndtk'
import { sanitize } from 'expressio'
import merge from 'lodash/merge'
import Sequelize from 'sequelize'
import path from 'path'
import fs from 'fs'

import migrations from './migrations'

/**
 * Auto load models
 * and return them into
 * a single object
 */
function getModels(dir, sequelize) {
  const models = {}

  fs.readdirSync(dir)
    .filter(file => ((file.indexOf('.') !== 0) && (file !== 'index.js')))
    .forEach((file) => {
      const model = sequelize.import(path.join(dir, file))
      models[model.name] = model
    })

  // Run associations
  Object.values(models).forEach(md => md.associate && md.associate(models))

  return models
}

/**
 * Get database directories
 * otherwise create it
 *
 * /models
 * /db
 * /migrations
 * /sqlite
 */
function getDirs(root, isSqlite) {
  const models = path.join(root, 'models')
  const db = path.join(root, 'db')
  const migrations = path.join(db, 'migrations') // eslint-disable-line
  const sqlite = path.join(db, 'sqlite')

  if (!ndtk.isDir(models)) fs.mkdirSync(models)
  if (!ndtk.isDir(db)) fs.mkdirSync(db)
  if (!ndtk.isDir(sqlite) && isSqlite) fs.mkdirSync(sqlite)
  if (!ndtk.isDir(migrations)) fs.mkdirSync(migrations)

  return {
    models,
    db,
    migrations,
    sqlite,
  }
}

/**
 * Format Sequelize errors
 */
const errorHandler = (err, req, res, next) => {
  const allowed = ['SequelizeUniqueConstraintError', 'SequelizeValidationError']

  if (allowed.includes(err.name)) {
    const iterator = (obj, { message, path, validatorKey }) => Object.assign({}, obj, { // eslint-disable-line
      [path]: {
        message: validatorKey === 'not_unique' ? `${path} is already in use` : message,
        type: validatorKey === 'not_unique' ? 'unique' : validatorKey,
      },
    })

    const seqError = ndtk.httpError(422, {
      message: 'Invalid data',
      type: 'VALIDATION',
      attributes: err.errors.reduce(iterator, {}),
    })

    return next(seqError)
  }

  return next(err)
}

/**
 * Object schemas
 * to validate configuration
 */
const schema = Joi.object({
  enabled: Joi.boolean().required(),
  debug: Joi.boolean().required(),

  paths: Joi.object({
    seed: Joi.string().required(),
  }).required(),

  conn: Joi.object({
    uri: Joi.string().required(),
    dialect: Joi.string().valid('sqlite', 'postgres').required(),
    options: Joi.object().required(),
  }).required(),
})

/**
 * Initializer
 */
export default (server) => {
  // Load and sanitize config variables
  const defaults = ndtk.config(ndtk.req('./config'))
  const uncheckedConfig = merge(defaults, server.config)
  const config = sanitize(uncheckedConfig.sequel, schema, 'Invalid Sequel config')

  if (!config.enabled) return

  // Expose local configs
  // to the server object
  server.config = {
    ...server.config,
    sequel: config,
  }

  const { conn } = config
  const isSqlite = conn.dialect === 'sqlite'

  // Get / Create directories
  const dir = getDirs(server.root, isSqlite)
  const seedPath = path.join(server.root, config.paths.seed)


  // Create new Sequelize instance
  const connection = isSqlite ? `sqlite://${dir.sqlite}/${conn.uri}` : `postgres://${conn.uri}`
  const sequelize = new Sequelize(connection, {
    logging: server.debug ? msg => msg.indexOf('SequelizeMeta') === -1 && server.logger.info(msg) : null,
    ...config.options,
  })

  // Setup models
  const models = getModels(dir.models, sequelize)

  // Setup migrations api
  const migrate = migrations(sequelize, dir.migrations, server.logger)


  /**
   * Connect
   */
  const connect = async () => {
    try {
      const { pending } = await migrate.status()
      if (pending.length) throw new Error('Sequel error: please execute pending migrations')
      await sequelize.authenticate()
      server.logger.info(`Sequel: Connected to ${conn.dialect}`)
    } catch (e) {
      ndtk.assert(false, e)
    }
  }

  /**
   * Disconnect
   */
  const disconnect = async () => {
    await sequelize.close()
  }

  /**
   * Reset
   */
  const reset = async () => {
    await sequelize.drop()
    await migrate.run('up')
  }

  /**
   * Seed
   */
  const seed = async () => {
    const fn = ndtk.req(seedPath)

    if (fn) {
      await reset()
      server.logger.info('Sequel: adding seed data...')

      try {
        await fn(models, server.env)
        server.logger.info('Sequel: Seed data added successfuly')
      } catch (e) {
        server.logger.error(e)
      }
    } else {
      ndtk.assert(false, `Sequel Error: "${seedPath}" seed path is not valid.`)
    }
  }

  /**
   * Truncate
   */
  const truncate = async () => {
    server.logger.info('Sequel: Truncating tables...')

    const values = Object.values(models)
    const promises = values.map(model => model.destroy({ truncate: true }))
    await Promise.all(promises)

    server.logger.info('Sequel: Tables truncated successfully')
  }

  /**
   * Run
   */
  const run = async (cmd) => {
    const tasks = { seed, reset, truncate }
    if (['up', 'down', 'prev', 'next'].includes(cmd)) await migrate.run(cmd)
    if (['seed', 'reset', 'truncate'].includes(cmd)) await tasks[cmd]()
    process.exit(0)
  }

  // Expose the Database API
  // to the server object
  server.sequel = {
    connect,
    disconnect,
    seed,
    truncate,
    run,
    reset,
    migrate,
    models,
    Op: Sequelize.Op,
    Sequelize,
    instance: sequelize,
  }

  server.Sequelize = Sequelize

  // Register events
  server.events.on('beforeStart', srv => srv.use(errorHandler))
  server.events.on('beforeStart', connect)
  server.events.on('beforeStop', disconnect)
}
