import expressio, { httpError } from 'expressio'
import sequel from '@'

const app = expressio()
app.initialize('sequel', sequel)

app.post('/user', async (req, res) => {
  const { body } = req
  const { models } = req.app.sequel

  const user = await models.User.create({ ...body })
  res.json(user)
})

app.get('/user/:id', async (req, res) => {
  const { params } = req
  const { models } = req.app.sequel

  const user = await models.User.findByPk(params.id)

  if (!user) throw httpError(400, { message: 'User does not exist' })
  res.json(user)
})

export default app
