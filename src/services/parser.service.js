const models = require('../models')
const puppeteer = require('puppeteer')
const { TimeoutError } = require('puppeteer')
const moment = require('moment')
const {process_params} = require('express/lib/router')

class ParserService {
    static actualRequestId = ''
    static actualRequest = false
    static lastOffset = 0

    static async createRequest({ place, rating = [], price = [], reportCount }) {
        const request = await models.RequestModel.create({ place, rating: rating.join(','), price: price.join(','), reportCount })
        await ParserService.deleteOldRequests()
        ParserService.initRequest(request)
        return request
    }

    static initRequest(request) {
        ParserService.actualRequestId = request.id
        ParserService.actualRequest = request
        ParserService.startParsing()
    }

    static async startParsing() {
        while (ParserService.actualRequestId) {
            try {
                const [hotelNames, country]  = await ParserService.getHotels(ParserService.actualRequest, ParserService.lastOffset)
                if (hotelNames?.length > 0 && country) {
                    for (let i in hotelNames) {
                        if (ParserService.actualRequestId) {
                            const hotelInfo = await ParserService.getEmailFromOfficialSite(hotelNames[i])

                            if (hotelInfo?.name) {
                                const { name, emails, executionTime, officialUrl} = hotelInfo
                                try {
                                    await models.HotelModel.create({ name, email: emails?.join(','), executionTime, officialUrl, country, requestId: ParserService.actualRequestId })
                                } catch (err) {
                                    console.log(err)
                                }
                            }

                        } else {
                            console.log('parsing stopped')
                            console.log(ParserService.actualRequestId)
                            console.log(333)
                            console.log(ParserService.actualRequest)
                            break
                        }
                    }
                    ParserService.lastOffset = ParserService.lastOffset + 25
                } else {
                    ParserService.actualRequestId = false
                    ParserService.lastOffset = 0
                    console.log('parsing stopped')
                    console.log(222)
                    console.log(ParserService.actualRequestId)
                    console.log(ParserService.actualRequest)
                    break
                }
            } catch (err) {
                ParserService.lastOffset = ParserService.lastOffset + 25
                console.log('retry')
                console.log(err)
            }

        }

    }

    static stopParsing() {
        ParserService.actualRequestId = false
        ParserService.actualRequest = false
    }

    static async getHotels(request, offset = 0) {
        let browser
        console.log(1)
        try {
            const url = ParserService.getBookingUrl(request, offset)
            console.log(url)
            const browserParams = process.env.PRODUCTION_MODE === 'FALSE'
                ?   { headless: true, devtools: true }
                :   { headless: true, devtools: true, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] }
            browser = await puppeteer.launch(browserParams)

            const page = await browser.newPage()
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36')

            await page.setJavaScriptEnabled(false)
            await page.setRequestInterception(true);
            page.on('request', request => {
                if (['image', 'font', 'stylesheet'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            })

            await page.goto(url, { waitUntil: 'networkidle2' })


            const country = await page.$eval('div[data-testid="breadcrumbs"]', element => Array.from(element.querySelector('ol').querySelectorAll('li'))[1].querySelector('a').querySelector('span').innerText)

            let names
            if (+request?.reportCount === 0) {
                names = await page.$$eval('div[data-testid="title"]', (elements) => elements.map(el => el.innerText))
            } else {
                names = await page.$$eval('div[data-testid="property-card-container"]', cards => {
                    return cards.map(card => {
                        const name = card.querySelector('div[data-testid="title"]').innerText
                        const reviewScope = card.querySelector('div[data-testid="review-score"]')

                        if (reviewScope !== null) {
                            if (reviewScope.querySelectorAll('div')[3]) {
                                const reportCount = +reviewScope.querySelectorAll('div')[3]?.innerText?.split(' ')[0]

                                return { name, reportCount }
                            }
                        }
                    })
                })

                names = names.filter(name => {
                    if (name === null) return false

                    return name.reportCount > +request?.reportCount;
                }).map(name => name.name)
            }


            await browser.close()
            console.log(names)
            return [names, country]
        } catch (err) {
            browser ? await browser.close() : null
            console.log(err)

            return [[], '']
        }

    }

    static getBookingUrl({ place, rating, price }, offset) {
        let ratingUrl = ''
        let priceUrl = ''
        let nfltUrl = ''
        let offsetUrl = ''

        if (rating) {
            ratingUrl = rating.split(',').join(';')
        }

        if (price) {
            priceUrl = `price=RUB-${price.split(',')[0]}-${price.split(',')[1]}-1`
        }

        if (priceUrl || ratingUrl) {
            nfltUrl = `&nflt=${encodeURIComponent(priceUrl + ';' + ratingUrl)}`
        }

        if (offset) {
            offsetUrl = `&offset=${offset}`
        }

        const checking = moment().add('4', 'm').format('YYYY-MM-DD')
        const checkout = moment().add('4', 'm').add('3', 'd').format('YYYY-MM-DD')

        return `https://www.booking.com/searchresults.ru.html?ss=${encodeURI(place)}${nfltUrl}&group_adults=2&no_rooms=1&group_children=0&checkin=${checking}&checkout=${checkout}${offsetUrl}`
    }

    static async getEmailFromOfficialSite(hotelName) {
        const start = new Date().getTime()
        let browser
        console.log(2)
        try {
            const browserParams = process.env.PRODUCTION_MODE === 'FALSE'
                ?   { headless: true, devtools: true }
                :   { headless: true, devtools: true, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] }
            browser = await puppeteer.launch(browserParams)

            const page = await browser.newPage()
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36')
            await page.goto('https://www.google.ru/maps/', { waitUntil: 'networkidle2' })

            await page.type(`input[name=q]`, hotelName, {delay: 20})

            await page.waitForSelector('div[data-index="0"]', { timeout: 1800 })
            await page.click('div[data-index="0"]')

            try {
                await page.waitForSelector('a[data-tooltip="Перейти на сайт"]', { timeout: 1800 })
            } catch (err) {
                if (err instanceof TimeoutError) {
                    await page.waitForSelector('div[role="feed"]', { timeout: 800 })
                    await page.evaluate(() => document.querySelector('div[role="feed"]').querySelectorAll('a')[1].click())
                    await page.waitForSelector('a[data-tooltip="Перейти на сайт"]', { timeout: 1000 })
                }
            }

            const url = await page.$eval('a[data-tooltip="Перейти на сайт"]', (element) => element.href)

            if (url) {
                const page2 = await browser.newPage()
                await page2.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36')
                await page2.setRequestInterception(true);
                page2.on('request', request => {
                    if (['image', 'font'].includes(request.resourceType())) {
                        request.abort();
                    } else {
                        request.continue();
                    }
                });
                await page2.goto(url, { waitUntil: 'networkidle2' })
                const htmlPage = await page2.evaluate(() => document.documentElement.innerHTML)
                const match = htmlPage.match(/[\w\.-]+@[\w\.-]+\.\w+/gu)

                await browser.close()

                if (match) {
                    const emails = Array.from(new Set(match.filter((item => {
                        return  !/\.jpg$/ug.test(item) &&
                                !/[0-9]$/ug.test(item) &&
                                !/\.png$/ug.test(item) &&
                                !/wixpress/ug.test(item)
                    }))))

                    return {
                        name: hotelName,
                        emails: emails,
                        executionTime: new Date().getTime() - start,
                        officialUrl: url
                    }
                } else {
                    return {
                        name: hotelName,
                        emails: [],
                        executionTime: new Date().getTime() - start,
                        officialUrl: url
                    }
                }
            } else {
                await browser.close()
                return {
                    name: hotelName,
                    emails: [],
                    executionTime: new Date().getTime() - start,
                    officialUrl: null
                }
            }
        } catch (error) {
            browser ? await browser.close() : null
            console.log(error)
                return {
                    name: hotelName,
                    emails: [],
                    executionTime: new Date().getTime() - start,
                    officialUrl: null
                }
        }
    }

    static async getHotelsByRequest(requestId, page) {
        return await ParserService.getHotelsInDB(requestId, page)
    }

    static async getHotelsByCurrentRequest(page) {
        if (ParserService.actualRequestId) {
            return await ParserService.getHotelsInDB(ParserService.actualRequestId, page)
        }

        const lastRequest = await models.RequestModel.findAll({raw: true, order: [['createdAt', 'DESC']], limit: 1})

        if (lastRequest.length > 0) {
            return ParserService.getHotelsInDB(lastRequest[0].id, page)
        }

        return []
    }

    static async getHotelsInDB(requestId, page) {
        const data =  await models.HotelModel.findAll({where: {requestId: requestId}, raw: true})
        const filteredData = data.filter(item => item?.email)

        return {
            result: data.filter(item => item?.email).slice(page*30, page*30 + 30),
            total: filteredData.length
        }

    }

    static async deleteOldRequests() {
        const requests = await models.RequestModel.findAll({offset: 20, order: [['createdAt', 'DESC']]})

        await Promise.all(requests.map(async request => {
            await models.HotelModel.destroy({where: { requestId: request.id }})
            await models.RequestModel.destroy({ where: {id: request.id} })
        }))
    }
}

module.exports = ParserService