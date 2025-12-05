const http      = require("node:http");
const https     = require("node:https");
const axios     = require('axios');
const cheerio   = require('cheerio');
const regexMyLPGFuel = new RegExp("([0-9.]+)");

async function getFuelPrice(country) {
    console.log("start fuel price");
    const url = "https://www.mylpg.eu/stations/ireland/prices/";

    axios.get(url).then((resp) => {
        const $ = cheerio.load(resp.data);
        const headers = [];
        const data = [];
        
        // Find headers first
        $("tbody").find("tr").find("th").each((k, v) => {
            var fuelType = $(v).text().trim().toLowerCase();

            // Convert to our lingo
            if (fuelType == "unleaded") {
                fuelType = "petrol"
            }

            headers.push(fuelType);
        });

        // Then find values
        $("tbody").find("tr").find("span").each((k, v) => {
            var fuelPrice = $(v).text();
            var priceMatches = fuelPrice.match(regexMyLPGFuel);

            if (priceMatches.length > 0) {
                data.push(priceMatches[0]);
            } else {
                data.push("0");
            }
        });

        var i = 0;

        while (i < headers.length && i < data.length) {
            console.log(`${headers[i]}\t - ${data[i]}`);
            i++;
        }
    }).catch((err) => {
        console.log("Error fetch page:");
        console.error(err);
    });
}

module.exports = {
    getFuelPrice: getFuelPrice
}