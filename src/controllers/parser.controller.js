const ParserService = require('../services/parser.service')
const {static} = require('express')

class ParserController {
    static async postRequest(req, res) {
        try {
            const data = await ParserService.createRequest(req.body)

            return res.status(200).json(data)
        } catch (err) {
            console.log(err)
        }
    }

    static async deleteRequest(req, res) {
        try {
            ParserService.stopParsing()

            return res.status(200).json({status: 'ok'})
        } catch (err) {
            console.log(err)
        }
    }

    static async getHotel(req, res) {
        try {
            let data = []

            if (req.query?.request) {
                data = await ParserService.getHotelsByRequest(req.query.request, req.query.page)
            } else {
                data = await ParserService.getHotelsByCurrentRequest(req.query.page)
            }

            return res.status(200).json(data)
        } catch (err) {
            console.log(err)
        }
    }
}



module.exports = ParserController