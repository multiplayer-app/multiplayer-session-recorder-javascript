import 'dotenv/config'
import './opentelemetry'
import http from 'http'
import cors from 'cors'
import bodyParser from 'body-parser'
import express, {
    type Request,
    type Response,
    type NextFunction,
} from 'express'
import { PORT, API_PREFIX } from './config'
import api from './api'

const app = express()

app.use(cors())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use(API_PREFIX, api)

app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).send('Not found')
  })

const httpServer = http.createServer(app)
const onReady = () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}`)
}

httpServer.listen(PORT, onReady)

const exitHandler = async (error: Error) => {
    if (error) {
        console.log('Server exited with error', error)
    }
    process.removeListener('exit', exitHandler)
    process.exit()
}

process.on('exit', exitHandler)
process.on('SIGINT', exitHandler)
process.on('SIGTERM', exitHandler)
process.on('uncaughtException', (err) => {
    console.error('uncaughtException', err)
})
