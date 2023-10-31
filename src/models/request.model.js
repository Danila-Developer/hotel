const sequelize = require('../db')
const { DataTypes } = require('sequelize')

const RequestModel = sequelize.define(
    'request',
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        place: {
            type: DataTypes.STRING,
            allowNull: false
        },
        rating: {
            type: DataTypes.STRING,
            allowNull: true
        },
        price: {
            type: DataTypes.STRING,
            allowNull: true
        },
        reportCount: {
            type: DataTypes.STRING,
            allowNull: true
        },
    },
    {
        updatedAt: false,
        createdAt: true,
        tableName: 'request'
    }
)


module.exports = RequestModel