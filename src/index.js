require('dotenv').config()

const express = require('express')
const puppeteer = require('puppeteer')
const { TimeoutError } = require('puppeteer')
const axios = require('axios')
const router = require('./router')
const cors = require('cors')
const path = require('path')

const server = express()

const sequelize = require('./db')
const models = require('./models/index')
const SearchController = require('./controllers/search.controller')


const PORT = process.env.PORT

const corsConfig = {
    origin: 'http://localhost:3000',
    credentials: true
}
server.use('/', express.static(path.resolve(__dirname, '../public/static/')));
server.use('/static', express.static(path.resolve(__dirname, '../public/static/')));
console.log(path.resolve(__dirname, '../public/static/'))
server.use(cors(corsConfig));
server.options('*', cors(corsConfig))
server.use(express.json())
server.use('/api', router)
server.get('/', (req, res) => {
    return res.sendFile(path.resolve(__dirname, '../public/index.html'))
})


async function startApp() {
    try {
        await sequelize.authenticate()
        await sequelize.sync()
        server.listen(PORT, () => {
            console.log(`Сервер успешно запушен на порту ${PORT}`)
        })
    } catch (e) {
        console.log(e)
    }
}

startApp()


