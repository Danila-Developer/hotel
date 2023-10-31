const RequestModel = require('./request.model')
const HotelModel = require('./hotel.model')

HotelModel.belongsTo(RequestModel)
RequestModel.hasMany(HotelModel)

module.exports = {
    RequestModel,
    HotelModel
}