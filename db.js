const fuel = require("./fuel");

// SQLite server
const sqlite3 = require("sqlite3").verbose()

// Load the database
const conn = new sqlite3.Database("costtodrive.db");

// Functions
async function getSourceID(URL) {
    var sql = `SELECT [SRC].[ID],
                      [SRC].[URL],
                      [SRC].[DateAdded]
                 FROM [Sources] AS [SRC]
                WHERE [SRC].[URL] = ?
                      LIMIT 1`;
    var params = [URL];

    return new Promise((resolve, reject) => {
        conn.get(sql, params, function(err, res) {
            if (!err) {
                if (!res) { 
                    reject("Now data returned");
                    return;
                }

                resolve({
                    ID: res.ID,
                    URL: URL,
                    LastUpdated: res.LastUpdated
                });
            } else {
                reject(err);
            }
        });
    });
}

async function insertNewCurrencyRates(currencyConversion, sourceID) {
    // This object is expected to be in the format of
    // {
    //     last_updated_at: "2025-12-02T23:59:59Z",
    //     rates: {
    //         EUR: 1,
    //         GBP: 2
    //     }
    // }

    // console.log("Inserting the following:");
    // console.log(currencyConversion);

    // Convert our object into a select statement that we can 
    // use to insert into the database
    var sql = "";
    var params = [
        currencyConversion.last_updated_at || "NULL", 
        sourceID                           || "NULL"
    ];

    Object.keys(currencyConversion.rates).forEach(function(currency) {
        if (sql !== "") {
            sql += " UNION ALL\n                   ";
        }

        sql = sql + `SELECT ? AS [Currency], ? AS [Rate]`
        params.push(currency, currencyConversion.rates[currency]);
    });

    sql = `INSERT INTO [CurrencyConversionLog] (
                  [SourceID],
                  [Batch],
                  [Timestamp],
                  [Currency],
                  [Value])
            
           SELECT [Source].[ID]         AS [SourceID],
                  [CCL].[LastBatch] + 1 AS [Batch],
                  [Meta].[LastUpdated]  AS [Timestamp],
                  [NewRates].[Currency] AS [Currency],
                  [NewRates].[Rate]     AS [Value]
             FROM ( SELECT ? AS [LastUpdated] ) AS [Meta],
                  ( SELECT ? AS [ID] ) AS [Source],
                  (
                   ${sql}
                  ) AS [NewRates]
                  ( SELECT IFNULL(MAX([CCL].[Batch]), 0) AS [LastBatch]
                      FROM [CurrencyConversionLog] AS [CCL]
                           LIMIT 1 ) AS [CCL]`;

    // console.log(sql);
    // console.log(params);

    return new Promise((resolve, reject) => {
        conn.all(sql, params, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

async function getCurrencyRates() {
    var result = {
        last_updated_at: null,
        prime_currency:   "",
        rates:           { }
    };

    var sql = `SELECT MAX([CCL].[Timestamp]) AS [LastUpdated],
                      [CCL].[Currency]       AS [Currency],
                      AVG([CCL].[Value])     AS [Rate]
                 FROM [CurrencyConversionLog] AS [CCL]
                --WHERE julianday(CURRENT_TIMESTAMP) - julianday([CCL].[Timestamp]) < 1
                      GROUP BY [CCL].[Currency]
               HAVING AVG([CCL].[Value]) > 0
                      ORDER BY [LastUpdated] ASC,
                               [Currency]    ASC`;

    return new Promise((resolve, reject) => {
        conn.serialize(() => {
            conn.each(sql,
                      (err, row) => {
                        if (!err) {
                            result.last_updated_at = new Date(row.LastUpdated);
                            result.rates[row.Currency.toUpperCase()] = row.Rate;

                            // Set the prime currency if rate was 1.0
                            if (row.Rate == 1 && result.prime_currency == "") {
                                result.prime_currency = row.Currency;
                            }
                        } else {
                            console.error(err);
                        }}, 
                      (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
            });
        });
    });
}

async function getFuelTypes() {
    var sql = `SELECT [FT].[ID],
                      [FT].[Description] AS [Name]
                 FROM [FuelTypes] AS [FT]`

    var result = { };

    return new Promise((resolve, reject) => {
        conn.serialize(() => {
            conn.each(sql,
                    (err, row) => {
                        if (err) {
                            console.error(err);
                            return;
                        }

                        if (!row) { return; }

                        var Name = "";
                        
                        if (row.Name) {
                            if (row.Name.length > 0) {
                                Name = row.Name;
                            }
                        }
                        
                        result[Number(row.ID)] = Name.trim();
                    },
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        resolve(result);
                        return;
                    }
            )
        });
    });
}

async function insertNewFuelPrices(fuelPrices, sourceID) {
    var sql = "";
    var params = [
        fuelPrices.last_updated_at || "NULL",
        fuelPrices.country_code    || "NULL",
        sourceID                   || "NULL"
    ];

    Object.keys(fuelPrices.prices).forEach(function(newPrice) {
        var price = fuelPrices.prices[newPrice];

        if (newPrice.fuelID <= 0) { return; }

        if (sql !== "") {
            sql += " UNION ALL\n        ";
        }

        sql = sql + `SELECT ? AS [Currency], ? AS [FuelID], ? AS [Price]`;

        params.push(price.currency, Number(price.fuelID), Number(price.price));
    });

    sql = `
INSERT INTO [FuelPriceLog] (
       [SourceID],
       [Batch],
       [Timestamp],
       [CountryCode],
       [Currency],
       [FuelID],
       [Value])
SELECT [Source].[ID]          AS [SourceID],
       [FPL].[LastBatch] + 1  AS [Batch],
       [Meta].[LastUpdated]   AS [Timestmap],
       [Meta].[CountryCode]   AS [CountryCode],
       [NewPrices].[Currency] AS [Currency],
       [NewPrices].[FuelID]   AS [FuelID],
       [NewPrices].[Price]    AS [Price]
  FROM ( SELECT ? AS [LastUpdated],
                ? AS [CountryCode] ) AS [Meta],
       ( SELECT ? AS [ID])           AS [Source],
       ( SELECT IFNULL(MAX([FPL].[Batch]), 0) AS [LastBatch]
           FROM [FuelPriceLog] AS [FPL]
                LIMIT 1 ) AS [FPL],
       (
        ${sql}
       ) AS [NewPrices]`;
    
    return new Promise((resolve, reject) => {
        conn.all(sql, params, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

async function getFuelPrices(countryCode) {
    var result = {
        last_updated_at: null,
        country_code:    countryCode,
        prices:          { }
    };

    var sql = `SELECT MAX([FPL].[Timestamp]) AS [LastUpdated],
                      [FPL].[FuelID]         AS [FuelID],
                      [FT].[Description]     AS [FuelName],
                      [FPL].[Currency]       AS [Currency],
                      AVG([FPL].[Value])     AS [Price]
                 FROM [FuelPriceLog] AS [FPL]
                      LEFT OUTER JOIN [FuelTypes] AS [FT]
                                   ON [FT].[ID] = [FPL].[FuelID]
                WHERE [FPL].[CountryCode] = $CountryCode
                      GROUP BY [FPL].[FuelID],
                               [FT].[Description],
                               [FPL].[Currency]
                      ORDER BY [LastUpdated] ASC,
                               [Currency]    ASC,
                               [FuelID]      ASC`

    var params = {
        $CountryCode: countryCode
    };

    // console.log(sql);
    // console.log(params);
    
    return new Promise((resolve, reject) => {
        conn.serialize(() => {
            conn.each(sql,
                      params,
                      (err, row) => {
                        if (!err) {
                            result.last_updated_at = new Date(row.LastUpdated);
                            result.country_code = countryCode;

                            var fuelName = "unknown";

                            if (row.FuelName) {
                                if (row.FuelName.length > 0) {
                                    fuelName = row.FuelName.trim().toLowerCase();
                                }
                            }

                            result.prices[fuelName] = {
                                currency: row.Currency || "",
                                fuelID:   row.FuelID   || "",
                                price:    row.Price    || 0.0
                            };
                        } else {
                            // continue despite error during each iteration
                            console.error(err);
                        }
                      },
                      (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
            });
        });
    });
}

module.exports = {
    conn:                   conn,
    getCurrencyRates:       getCurrencyRates,
    getSourceID:            getSourceID,
    insertNewCurrencyRates: insertNewCurrencyRates,
    getFuelTypes:           getFuelTypes,
    getFuelPrices:          getFuelPrices,
    insertNewFuelPrices:    insertNewFuelPrices
};