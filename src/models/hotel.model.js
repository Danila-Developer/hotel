const sequelize = require('../db')
const { DataTypes } = require('sequelize')

const HotelModel = sequelize.define(
    'hotel',
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        email: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        city: {
            type: DataTypes.STRING,
            allowNull: true
        },
        country: {
            type: DataTypes.STRING,
            allowNull: true
        },
        executionTime: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        bookingUrl: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        officialUrl: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    },
    {
        updatedAt: false,
        createdAt: true,
        tableName: 'hotel'
    }
)


module.exports = HotelModel