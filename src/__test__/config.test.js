import config from '@/config'

describe('Expressio Sequel / Configs', () => {
  it('should match a valid config object', () => {
    expect(config).toEqual({
      default: {
        sequel: {
          enabled: true,
          debug: true,
          paths: {
            seed: '/db/seed.js',
          },
          conn: {
            dialect: null,
            uri: null,
            options: {},
          },
        },
      },
      test: {
        sequel: {
          debug: false,
        },
      },
      production: {
        sequel: {
          debug: false,
        },
      },
    })
  })
})
