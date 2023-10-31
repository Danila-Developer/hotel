const models = require('../models')
const puppeteer = require('puppeteer')
const { TimeoutError } = require('puppeteer')
const moment = require('moment')

class ParserService {
    static actualRequestId = ''
    static actualRequest = false

    static async createRequest({ place, rating = [], price = [], reportCount }) {
        const request = await models.RequestModel.create({ place, rating: rating.join(','), price: price.join(','), reportCount })
        ParserService.initRequest(request)
        return request
    }

    static initRequest(request) {
        ParserService.actualRequestId = request.id
        ParserService.actualRequest = request
        ParserService.startParsing()
    }

    static async startParsing() {
        let offset = 0

        while (ParserService.actualRequestId) {
            const [hotelNames, country]  = await ParserService.getHotels(ParserService.actualRequest, offset)
            if (hotelNames?.length > 0) {
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
                        break
                    }
                }
                offset = offset + 25
            } else {
                ParserService.actualRequestId = false
                break
            }
        }

    }

    static stopParsing() {
        ParserService.actualRequestId = false
        ParserService.actualRequest = false
    }

    static async getHotels(request, offset = 0) {
        const url = ParserService.getBookingUrl(request, offset)

        const browser = await puppeteer.launch({ headless: true, devtools: true, executablePath: '/usr/bin/chromium-browser' })
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
        });

        await page.goto(url, { waitUntil: 'networkidle2' })
        const names = await page.$$eval('div[data-testid="title"]', (elements) => elements.map(el => el.innerText))
        const country = await page.$eval('div[data-testid="breadcrumbs"]', element => Array.from(element.querySelector('ol').querySelectorAll('li'))[1].querySelector('a').querySelector('span').innerText)

        await browser.close()

        return [names, country]
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
        const start = new Date().getTime();
        const browser = await puppeteer.launch({ headless: true, devtools: true, executablePath: '/usr/bin/chromium-browser' })

        try {
            const page = await browser.newPage()
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36')
            await page.goto('https://www.google.ru/maps/', { waitUntil: 'networkidle2' })

            await page.type(`input[name=q]`, hotelName, {delay: 20})

            await page.waitForSelector('div[data-index="0"]', { timeout: 2000 })
            await page.click('div[data-index="0"]')

            try {
                await page.waitForSelector('a[data-tooltip="Перейти на сайт"]', { timeout: 3000 })
            } catch (err) {
                if (err instanceof TimeoutError) {
                    await page.waitForSelector('div[role="feed"]', { timeout: 3000 })
                    await page.evaluate(() => document.querySelector('div[role="feed"]').querySelectorAll('a')[1].click())
                    await page.waitForSelector('a[data-tooltip="Перейти на сайт"]', { timeout: 3000 })
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
                        return !/\.jpg$/ug.test(item) && !/[0-9]$/ug.test(item) && !/\.png$/ug.test(item)
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
            await browser.close()
            console.log(error)
                return {
                    name: hotelName,
                    emails: [],
                    executionTime: new Date().getTime() - start,
                    officialUrl: null
                }
        }
    }

    static async getHotelsByRequest(requestId) {
        return await ParserService.getHotelsInDB(requestId)
    }

    static async getHotelsByCurrentRequest() {
        if (ParserService.actualRequestId) {
            return await ParserService.getHotelsInDB(ParserService.actualRequestId)
        }

        const lastRequest = await models.RequestModel.findAll({raw: true, order: [['createdAt', 'DESC']], limit: 1})

        if (lastRequest.length > 0) {
            return ParserService.getHotelsInDB(lastRequest[0].id)
        }

        return []
    }

    static async getHotelsInDB(requestId) {
        const data =  await models.HotelModel.findAll({where: {requestId: requestId}, raw: true})

        return data.filter(item => item?.email)
    }
}

module.exports = ParserService