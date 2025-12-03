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

    return conn.get(sql, params, function(err, res) {
        if (!err) {
            return Promise.resolve({
                ID: res.ID,
                URL: URL,
                LastUpdated: res.LastUpdated
            });
        } else {
            return Promise.reject(err);
        }
    });
}

async function getCurrencyRates() {
    var result = {
        last_updated_at: null,
        idx_prime:       -1,
        rates:           { }
    };

    var sql = `SELECT MAX([CCL].[Timestamp]) AS [LastUpdated],
                      [CCL].[Currency]       AS [Currency],
                      AVG([CCL].[Value])     AS [Rate]
                 FROM [CurrencyConversionLog] AS [CCL]
                WHERE julianday(CURRENT_TIMESTAMP) - julianday([CCL].[Timestamp]) < 1
                      GROUP BY [CCL].[Currency]
               HAVING AVG([CCL].[Value]) > 0
                      ORDER BY [LastUpdated] ASC,
                               [Currency]    ASC`;

    conn.serialize(() => {
        conn.each(sql,
                  (err, row) => {
                    if (!err) {
                        result.last_updated_at = row.LastUpdated;
                        result.rates[row.Currency] = row.Rate;

                        // Set the prime currency if rate was 1.0
                        if (row.Rate == 1 && result.idx_prime < 0) {
                            result.idx_prime = result.rates.length;
                        }
                    } else {
                        console.error(err);
                    }}, 
                  (err) => {
                    if (err) {
                        return Promise.reject(err);
                    } else {
                        console.log("fin");
                        console.log(result);
                        return Promise.resolve(result);
                    }
        });        
    });
}


module.exports = {
    db: conn,
    getCurrencyRates: getCurrencyRates,
    getSourceID:      getSourceID
};