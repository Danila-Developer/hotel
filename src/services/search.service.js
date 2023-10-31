const axios = require('axios')
const models = require('../models')

class SearchService {
    static async getSearch(query) {
        const response = await axios.post('https://accommodations.booking.com/autocomplete.json', {
            language: 'ru',
            query: query,
            size: 5
        })
        const data = response.data

        return data?.results.map(item => {
            return {
                label: item.label,
                label1: item.label1,
                label2: item.label2,
                photo_uri: item.photo_uri
            }
        })
    }

    static async getRequestById(request) {
        return await models.RequestModel.findAll({where: {id: request}, raw: true, order: [['createdAt', 'DESC']]})
    }

    static async getAllRequests() {
        return await models.RequestModel.findAll({raw: true, order: [['createdAt', 'DESC']], limit: 20})
    }
}

module.exports = SearchService