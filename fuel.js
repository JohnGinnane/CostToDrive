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

var priceLog = null;

async function getFuelPrice(countryCode) {
    if (!countryCode) { return; }
    var country = countryURLs[countryCode.trim().toUpperCase()];

    console.log(`Fetching prices for ${country.Name}`)

    // "1.23 EUR/L"
    const regexPrice = new RegExp("([0-9.]+) ([a-zA-Z]+)\/L");

    // "Last prices from 05.12.2025"
    const regexDate  = new RegExp("Last prices from ([0-9.]+)");

    return new Promise((resolve, reject) => {
        axios.get(country.URL).then((resp) => {
            const $ = cheerio.load(resp.data);
            const headers    = [];
            const data       = [];
            const currencies = [];

            var Timestamp = null;

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
                var thisCurrency = "?";

                // Try to find the first span in each td
                var span = $(v).first("span");

                if (span) {
                    var fuelPrice = $(span).text().trim();

                    // console.log(`Raw Text: ${fuelPrice}`);

                    var priceMatches = fuelPrice.match(regexPrice);
                    
                    // console.log("regex: ");
                    // console.log(priceMatches);
                    
                    if (priceMatches) {
                        if (priceMatches.length > 1) {
                            thisPrice = priceMatches[1];
                        }

                        if (priceMatches.length > 2) {
                            thisCurrency = priceMatches[2];
                        }
                    }
                }

                data.push(Number(thisPrice));
                currencies.push(thisCurrency);
            });

            // Try to find the date of this information
            const h4Timestamp = divParent.children("h4").first();

            var dateText = $(h4Timestamp).text();
            var dateMatches = dateText.match(regexDate);

            if (dateMatches) {
                if (dateMatches.length > 1) {
                    var dateParts = dateMatches[1].split(".");

                    // why the CHRIST is month index 0??????????????????????????????????
                    Timestamp = new Date(dateParts[2], Number(dateParts[1])-1, dateParts[0]);
                }
            }

            // console.log(`Prices as of ${dateRetrieved.toISOString().slice(0, 10)}:`);

            // var i = 0;

            // while (i < headers.length) {
            //     console.log(`${headers[i]}\t - ${currencies[i]} ${data[i]}`);
            //     i++;
            // }
            
            // Format into our fuel object
            var result = {
                last_updated_at: Timestamp || "",
                country_code:    countryCode,
                prices: { }
            };

            var i = 0; 

            while (i < headers.length && i < data.length && i < currencies.length) {
                var fuelName = headers[i].toLowerCase();

                result.prices[fuelName] = {
                    currency: currencies[i],
                    fuelID:   -1,
                    price:    data[i]
                };

                i++;
            }

            // console.log("Parsed fuel prices: ");
            // console.log(result);

            return resolve(result);
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
        // console.log(resp.status);
        // console.log(resp.statusText);

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
    getFuelPrice:  getFuelPrice,
    listCountries: listCountries,
    priceLog:      priceLog
}