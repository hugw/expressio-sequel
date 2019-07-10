/**
 * Default configs
 *
 * @copyright Copyright (c) 2019, hugw.io
 * @author Hugo W - contact@hugw.io
 * @license MIT
 */

export default {
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

  // Test environment
  test: {
    sequel: {
      debug: false,
    },
  },

  // Production environment
  production: {
    sequel: {
      debug: false,
    },
  },
}
