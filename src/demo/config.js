export default {
  default: {
    sequel: {
      conn: {
        dialect: 'sqlite',
        uri: 'development.sqlite',
      },
    },
  },
  test: {
    sequel: {
      conn: {
        uri: 'test.sqlite',
      },
    },
  },
}
