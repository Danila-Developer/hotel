const SearchService = require('../services/search.service')
const ParserService = require('../services/parser.service')

class SearchController {

    static async postSearch(req, res) {
        try {
            const { query } = req.body
            const data = await SearchService.getSearch(query)

            return res.status(200).json(data)
        } catch (err) {
            console.log(err)
        }
    }

    static async getRequests(req, res) {
        try {
            let data = {}

            if (req.query?.request) {
                data = await SearchService.getRequestById(req.query?.request)
            } else {
                data = await SearchService.getAllRequests()
            }

            return res.status(200).json(data)
        } catch (err) {
            console.log(err)
        }
    }

    static async postRequestExport(req, res) {
        try {
            const path = await SearchService.getRequestExportPath(req.body)

            return res.status(200).sendFile(path)
        } catch (err) {
            console.log(err)
        }
    }
}

module.exports = SearchController