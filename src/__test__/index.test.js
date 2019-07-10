import request from 'supertest'

import database from '@'
import app from '../demo/app'

describe('Expressio Sequel / Initializer', () => {
  const on = jest.fn()

  const config = attrs => ({
    config: {
      sequel: {
        ...attrs,
      },
    },
  })

  const extras = {
    env: 'test',
    root: `${process.cwd()}/src/demo`,
    logger: {
      info: () => null,
    },
  }

  afterEach(() => {
    on.mockClear()
  })

  it('should load the initializer and expose an api to the server', () => {
    const server = { events: { on }, ...extras, ...config({ conn: { dialect: 'sqlite', uri: 'test.sqlite' } }) }
    database(server)

    const { sequel } = server

    expect(Object.keys(sequel)).toEqual(['connect', 'disconnect', 'seed', 'truncate', 'run', 'reset', 'migrate', 'models', 'Op', 'Sequelize', 'instance'])
    expect(Object.keys(sequel.models)).toEqual(['Task', 'User'])
    expect(Object.keys(sequel.migrate)).toEqual(['status', 'down', 'up', 'prev', 'next', 'summary', 'run'])
    expect(on).toHaveBeenCalledTimes(3)
  })

  it('should not load the initializer and expose an api to the server if enabled is set to "false"', () => {
    const server = { ...config({ enabled: false, conn: { uri: 'path', dialect: 'sqlite' } }) }
    database(server)

    expect(server.sequel).toBeFalsy()
    expect(on).toHaveBeenCalledTimes(0)
  })

  it('given no "conn.uri" config, it should throw an error with proper message', () => {
    const server = { ...config() }
    const fn = () => database(server)
    expect(fn).toThrow('Invalid Sequel config: "uri" must be a string')
  })

  it('given no "conn.dialect" config, it should throw an error with proper message', () => {
    const server = { ...config({ conn: { uri: 'path' } }) }
    const fn = () => database(server)
    expect(fn).toThrow('Invalid Sequel config: "dialect" must be a string')
  })

  it('given a bad "conn.dialect" config, it should throw an error with proper message', () => {
    const server = { ...config({ conn: { uri: 'path', dialect: 'bad' } }) }
    const fn = () => database(server)
    expect(fn).toThrow('Invalid Sequel config: "dialect" must be one of [sqlite, postgres]')
  })
})

describe('Expressio Sequel / Demo', () => {
  beforeAll(async () => {
    await app.sequel.seed()
    await app.start()
  })

  afterAll(() => {
    app.stop()
  })

  it('(POST /user) with valid params should return a user payload', async () => {
    const payload = { name: 'John Doe', email: 'john@doe.com' }
    const response = await request(app).post('/user')
      .send(payload)

    expect(response.status).toBe(200)
    expect(response.body.name).toBe('John Doe')
    expect(response.body.email).toBe('john@doe.com')
    expect(response.body.createdAt).toBeDefined()
    expect(response.body.updatedAt).toBeDefined()
  })

  it('(POST /user) with duplicate email should return an error message', async () => {
    const payload = { name: 'John Doe', email: 'john@doe.com' }
    const response = await request(app).post('/user')
      .send(payload)

    expect(response.status).toBe(422)
    expect(response.body.status).toBe(422)
    expect(response.body.message).toEqual('Invalid data')
    expect(response.body.type).toEqual('VALIDATION')
    expect(response.body.attributes).toEqual({
      email: {
        message: 'email is already in use',
        type: 'unique',
      },
    })
  })

  it('(GET /user/:id) with valid params should return an user payload', async () => {
    const id = 2
    const response = await request(app).get(`/user/${id}`)

    expect(response.status).toBe(200)
    expect(response.body.name).toBe('John Doe')
    expect(response.body.email).toBe('john@doe.com')
    expect(response.body.createdAt).toBeDefined()
    expect(response.body.updatedAt).toBeDefined()
  })

  it('(GET /user/:id) with not found id param should return an error message', async () => {
    const id = 30
    const response = await request(app).get(`/user/${id}`)

    expect(response.status).toBe(400)
    expect(response.body.status).toBe(400)
    expect(response.body.message).toEqual('User does not exist')
  })
})
