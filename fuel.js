const http      = require("node:http");
const https     = require("node:https");
const axios     = require('axios');
const cheerio   = require('cheerio');

const countryURLs = {
    IRL: {
        Name: "Ireland",
        URL: "https://www.mylpg.eu/stations/ireland/prices/",
        Currency: "EUR"
    },

    GBR: {
        Name: "Great Britain",
        URL: "https://www.mylpg.eu/stations/united-kingdom/",
        Currency: "GBP"
    }
}

async function getFuelPrice(countryCode) {
    if (!countryCode) { return; }
    var country = countryURLs[countryCode.trim().toUpperCase()];

    console.log(`Fetching prices for ${country.Name}`)

    // "1.23 EUR/L"
    const regexPrice = new RegExp("([0-9.]+)");

    // "Last prices from 05.12.2025"
    const regexDate  = new RegExp("Last prices from ([0-9.]+)");

    return new Promise((resolve, reject) => {
        axios.get(country.URL).then((resp) => {
            const $ = cheerio.load(resp.data);
            const headers = [];
            const data = [];
            var dateRetrieved = new Date();

            var fuelTable = null;
            
            // We're looking for the table that shares a div node with 
            // <a id="prices">
            // $("table").find(".table.table-striped.table-hover");

            const anchorPrices = $("a[id=prices]");

            if (!anchorPrices) {
                reject("Unable to locate prices");
                return;
            }

            const divParent = anchorPrices.parent();
            const tableBody = divParent.children("table").first().find("tbody").first();

            // Find headers first
            $(tableBody).find("tr").find("th").each((k, v) => {
                var fuelType = $(v).text().trim().toLowerCase();

                // Convert to our lingo
                if (fuelType == "unleaded") {
                    fuelType = "petrol"
                }

                headers.push(fuelType);
            });

            // Then find values
            $(tableBody).find("tr").find("td").each((k, v) => {
                var thisPrice = "0";

                // Try to find the first span in each td
                var span = $(v).first("span");

                if (span) {
                    var fuelPrice = $(span).text();

                    var priceMatches = fuelPrice.match(regexPrice);
                    
                    if (priceMatches) {
                        if (priceMatches.length > 1) {
                            thisPrice = priceMatches[1];
                        }
                    }
                }

                data.push(thisPrice);
            });

            // Try to find the date of this information
            const h4Timestamp = divParent.children("h4").first();

            var dateText = $(h4Timestamp).text();
            var dateMatches = dateText.match(regexDate);

            if (dateMatches) {
                if (dateMatches.length > 1) {
                    var dateParts = dateMatches[1].split(".");

                    // why the CHRIST is month index 0??????????????????????????????????
                    dateRetrieved = new Date(dateParts[2], Number(dateParts[1])-1, dateParts[0]);
                }
            }

            console.log(`Prices as of ${dateRetrieved.toISOString().slice(0, 10)}:`);

            var i = 0;

            while (i < headers.length && i < data.length) {
                console.log(`${headers[i]}\t - ${data[i]}`);
                i++;
            }

            return resolve({
                dateRetrieved: dateRetrieved,
                headers: headers,
                data: data
            });
        }).catch((err) => {
            console.log("Error fetching page:");
            console.error(err.message);
        });        
    });
}

async function listCountries() {
    const regexURL = new RegExp("www\.mylpg\.eu\/stations")
    const url = `https://www.mylpg.eu/stations/#countries`;
    
    axios.get(url).then((resp) => {
        const $ = cheerio.load(resp.data);
        console.log(resp.status);
        console.log(resp.statusText);

        $("ul").find("li").find("a").each((k, v) => {
            var countryURL = $(v).attr("href");
            if (!countryURL) { return; }
            var urlMatch = countryURL.match(regexURL);
            if (!urlMatch) { return; }
            
            console.log(`${$(v).text()} - ${$(v).attr("href")}`);
        });
    }).catch((err) => {
        console.log("Error listing countries:");
        console.error(err.message);
    });
}

module.exports = {
    getFuelPrice: getFuelPrice,
    listCountries: listCountries
}