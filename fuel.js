const http      = require("node:http");
const https     = require("node:https");
const axios     = require('axios');
const cheerio   = require('cheerio');

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const agentSelector = function(_parsedURL) {
    if (_parsedURL.protocol == 'http:') {
        return httpAgent;
    } else {
        return httpsAgent;
    }
}

async function getFuelPrice() {
    console.log("start fuel price");
    const url = "https://www.mylpg.eu/stations/ireland/prices/";

    axios.get(url).then((resp) => {
        const $ = cheerio.load(resp.data);
        const data = [];
        
        $("span").each((k, v) => {
            data.push($(v).text());
        });

        console.log(data);
    }).catch((err) => {
        console.log("Error fetch page:");
        console.error(err);
    });
}

module.exports = {
    getFuelPrice: getFuelPrice
}