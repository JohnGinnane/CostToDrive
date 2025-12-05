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

    console.log("Inserting the following:");
    console.log(currencyConversion);

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
                  ) AS [NewRates],
                  ( SELECT MAX([CCL].[Batch]) AS [LastBatch]
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


module.exports = {
    conn: conn,
    getCurrencyRates:       getCurrencyRates,
    getSourceID:            getSourceID,
    insertNewCurrencyRates: insertNewCurrencyRates
};