var createError  = require('http-errors');
var express      = require('express');
var path         = require('path');
var cookieParser = require('cookie-parser');
var logger       = require('morgan');
const http       = require("http");
const https      = require("https");
const fs         = require("fs");

var indexRouter  = require('./routes/index');
var usersRouter  = require('./routes/users');
var db           = require("./db");
var fuel         = require("./fuel");

// #region Functions
function log(str) {
    var today  = new Date();
    console.log("[" + today.toLocaleTimeString("en-IE") + "]", str);
}

// #endregion

//#region Config

// Create default values config
var config = {
    api_currency_key: "",
    last_started:     new Date().toISOString()
}

function saveConfig(filepath, obj) {
    log("Saving config");
    fs.writeFileSync(filepath, JSON.stringify(obj, null, 4), "utf-8");
}

// Check if config file exists
log("Looking for config...");

try {
    const config_stats = fs.statSync("./config.json");

    // We need to open the file and load it into a variable
    config = JSON.parse(fs.readFileSync("./config.json", { encoding: "utf-8", flag: "r" }));
    log("Last started: " + new Date(config.last_started).toLocaleString());
    config.last_started = new Date().toISOString();
    saveConfig("./config.json", config);
} catch (err) { 
    if (err.code === "ENOENT") {
        log("Config file not found, creating one");
        saveConfig("./config.json", config);
    } else {
        // Fatal error trying to read the
        // the file, which we really need
        console.error(err);
        process.exit(-1);
    }
}

log("config done");

//#endregion

// Init other components
fuel.init(db);

//#region Express

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// Add Bootstrap
app.use(express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

app.use(express.static(path.join(__dirname, "public")));

//#endregion

//#region Currency Conv
// Check database for latest currency conversions
// Get the most recent (if any!), and when it was
// last fetched from API
// This object will contain a list of currency codes and their rates
// Whichever rate has a value of 1.0 is considered the "prime" currency
// In order to convery from currency X to currency Y, we must first convert
// to from X to "prime", then from "prime" to Y
var currencyConversion = null;
const apiBaseURL = "https://api.currencyapi.com/";

db.getCurrencyRates().then((res) => {
    currencyConversion = res;

    var fetchNewRates = false;
    var dateCutOff = new Date();
    dateCutOff.setHours(dateCutOff.getHours() - 24);

    // If we don't have any conversion rates or 
    // the ones we have are out of date, then
    // fetch new rates!
    if (!currencyConversion) {
        fetchNewRates = true;
    } else {
        if (currencyConversion.last_updated_at < dateCutOff) {
            fetchNewRates = true;
        }
    }

    if (fetchNewRates) {
        log("Fetching new exchange rates!");

        // We need to get the ID of the source we're using
        // So when we log new rates, we can reference this source
        db.getSourceID(apiBaseURL).then((dbAPISource) => {
            // Do API call to get exchange rates
            https.get(`${apiBaseURL}v3/latest?apikey=${config.api_currency_key}&currencies=GBP%2CUSD%2CCAD&base_currency=EUR`, resp => {
                let data = ''
                resp.on('data', chunk => {
                    data += chunk;
                });

                // When the API call ends:
                // 1. Parse the data
                // 2. Convert to our format
                // 3. Insert into the database
                // This whole process really needs its own class...
                resp.on("end", () => {
                    var newCurrencyData = JSON.parse(data);
                    
                    // This "data" is expected to look like
                    // {
                    //     meta: { last_updated_at: '2025-12-02T23:59:59Z' },
                    //     data: {
                    //         CAD: { code: 'CAD', value: 1.6244535552 },
                    //         GBP: { code: 'GBP', value: 0.8796628277 },
                    //         USD: { code: 'USD', value: 1.1627905365 }
                    //     }
                    // }

                    // Convert to our standard conversion object
                    currencyConversion = {
                        last_updated_at: newCurrencyData.meta.last_updated_at,
                        prime_currency:   "EUR",
                        // Insert our prime currency rate
                        rates:           { EUR: 1.0 }
                    };

                    // Iterate over currencies and add to our rates
                    Object.keys(newCurrencyData.data).forEach(function(currency) {
                        currencyConversion.rates[currency.toUpperCase()] = newCurrencyData.data[currency].value;
                    });

                    // console.log("Our conversion object:");
                    // console.log(currencyConversion);

                    // Pass this conversion object to the DB to log
                    db.insertNewCurrencyRates(currencyConversion, dbAPISource.ID).then().catch((err) => {
                        console.log("Error inserting new rates:");
                        console.error(err);
                    });
                });
            });
        });
    }
});

//#endregion

//#region Websocket Init


const ws             = require("ws");
//const uuid           = require("uuid");
//const selfsigned     = require("selfsigned");

// // Create self signed cert for use by HTTPS
// const SSLCert =  selfsigned.generate(null, { days: 1 });
// const credential = {
//     key: SSLCert.private,
//     cert: SSLCert.cert
// }

// Start HTTPS server for secure web sockets
//const httpsServer = https.createServer(credential);
const httpServer = http.createServer();

httpServer.on('error', (err) => { console.error(err) });
httpServer.listen(3001, () =>  { log('HTTP running on port 3001') });

const webSocket = new ws.Server({ server: httpServer });

//#endregion

//#region Websocket Func
function getMakes(ws, containerID) {
    db.conn.serialize(() => {
        db.conn.each(`SELECT [MAK].[ID] AS [MakeID],
                        [MAK].[Name] AS [Name]
                   FROM [Makes] AS [MAK];`,
                (err, row) => {
            if (!err) {
                ws.send(JSON.stringify({
                    type: "make",
                    containerID: containerID,
                    data: {
                        MakeID: row.MakeID,
                        Name: row.Name
                    }
                }));
            } else {
                console.error(err);
            }
        });
    });
}

function getModels(ws, containerID, makeID) {
    db.conn.serialize(() => {
        db.conn.each(`SELECT [MOD].[ID] AS [ModelID],
                        [MOD].[Name] AS [Name]
                   FROM [Models] AS [MOD]
                  WHERE [MOD].[MakeID] = $makeID`, { $makeID: makeID },
                (err, row) => {
                    if (!err) {
                        ws.send(JSON.stringify({
                            type: "model",
                            containerID: containerID,
                            data: {
                                ModelID: row.ModelID,
                                Name:    row.Name
                            }
                        }));            
                    } else {
                        console.error(err);
                    }
        });
    })
}

function getYears(ws, containerID, makeID, modelID) {
    db.conn.serialize(() => {
        db.conn.each(`SELECT [VEH].[Year]
                   FROM [Makes] AS [MAK]
                        INNER JOIN [Models] AS [MOD]
                                ON [MOD].[MakeID] = [MAK].[ID]
                        INNER JOIN [Vehicles] AS [VEH]
                                ON [VEH].[ModelID] = [MOD].[ID]
                  WHERE [MAK].[ID] = $makeID
                    AND [MOD].[ID] = $modelID
                        GROUP BY [VEH].[Year]`,
                { $makeID:  makeID,
                  $modelID: modelID },
                (err, row) => {
                    if (!err) {
                        ws.send(JSON.stringify({
                            type: "year",
                            containerID: containerID,
                            data: {
                                Year: row.Year
                            }
                        }));
                    } else {
                        console.error(err);
                    }
        });
    });
}

function getFuelTypes(ws, containerID, makeID, modelID, year) {
    db.conn.serialize(() => {
        db.conn.each(`SELECT [FT].[ID],
                        [FT].[Description]
                   FROM [Makes] AS [MAK]
                        INNER JOIN [Models] AS [MOD]
                                ON [MAK].[ID] = [MOD].[MakeID]
                        INNER JOIN [Vehicles] AS [VEH]
                                ON [VEH].[ModelID] = [MOD].[ID]
                        INNER JOIN [FuelTypes] AS [FT]
                                ON [FT].[ID] = [VEH].[FuelID]
                  WHERE [MAK].[ID]   = $makeID
                    AND [MOD].[ID]   = $modelID
                    AND [VEH].[Year] = $year
                        GROUP BY [FT].[ID],
                                 [FT].[Description]`, 
                { $makeID:  makeID, 
                  $modelID: modelID, 
                  $year:    year },
                (err, row) => {
                    if (!err) {
                        ws.send(JSON.stringify({
                            type: "fueltype",
                            containerID: containerID,
                            data: {
                                FuelTypeID: row.ID,
                                Description: row.Description
                            }
                        }));
                    } else {
                        console.error(err);
                    }
        });
    });
}

function getEngineSizes(ws, containerID, makeID, modelID, year, fuelTypeID) {
    db.conn.serialize(() => {
        db.conn.each(`SELECT [VEH].[Displacement] AS [EngineSize]
                   FROM [Makes] AS [MAK]
                        INNER JOIN [Models] AS [MOD]
                                ON [MAK].[ID] = [MOD].[MakeID]
                        INNER JOIN [Vehicles] AS [VEH]
                                ON [VEH].[ModelID] = [MOD].[ID]
                        INNER JOIN [FuelTypes] AS [FT]
                                ON [FT].[ID] = [VEH].[FuelID]
                  WHERE [MAK].[ID]   = $makeID
                    AND [MOD].[ID]   = $modelID
                    AND [VEH].[Year] = $year
                    AND [FT].[ID]    = $fuelTypeID
                        GROUP BY [VEH].[Displacement]`, 

                { $makeID:     makeID,
                  $modelID:    modelID,
                  $year:       year,
                  $fuelTypeID: fuelTypeID },

                (err, row) => {
                    if (!err) {
                        ws.send(JSON.stringify({
                            type: "enginesize",
                            containerID: containerID,
                            data: {
                                EngineSize: row.EngineSize
                            }
                        }));
                    } else {
                        console.error(err);
                    }
                });
    });
}

function getFuelEconomies(ws, containerID, makeID, modelID, year, fuelTypeID, engineSize) {
    db.conn.serialize(() => {
        db.conn.each(`SELECT AVG([UrbanKMPL]) AS [AvgUrbanKMPL],
                        AVG([MotorwayKMPL]) AS [AvgMotorwayKMPL]
                   FROM [Makes] AS [MAK]
                        INNER JOIN [Models] AS [MOD]
                                ON [MAK].[ID] = [MOD].[MakeID]
                        INNER JOIN [Vehicles] AS [VEH]
                                ON [VEH].[ModelID] = [MOD].[ID]
                        INNER JOIN [FuelTypes] AS [FT]
                                ON [FT].[ID] = [VEH].[FuelID]
                  WHERE [MAK].[ID]           = $makeID
                    AND [MOD].[ID]           = $modelID
                    AND [VEH].[Year]         = $year
                    AND [FT].[ID]            = $fuelTypeID
                    AND [VEH].[Displacement] = $engineSize
                        LIMIT 1`,

                { $makeID:     makeID,
                  $modelID:    modelID,
                  $year:       year,
                  $fuelTypeID: fuelTypeID,
                  $engineSize: engineSize },

                (err, row) => {
                    if (!err) {
                        ws.send(JSON.stringify({
                            type:        "fueleconomy",
                            containerID: containerID,
                            data: {
                                AvgUrbanKMPL:    row.AvgUrbanKMPL,
                                AvgMotorwayKMPL: row.AvgMotorwayKMPL
                            }
                        }));
                    } else {
                        console.error(err);
                    }
                });
    });
}

function getCurrencyConversion(ws) {
    ws.send(JSON.stringify({
        type: "currencyconversion",
        data: currencyConversion
    }));
}

async function getFuelPrices(ws, containerID, countryCode) {
    return new Promise((resolve, reject) => {
        // // Do we have the fuel prices locally?
        // if (fuel.priceLog) {
        //     resolve(fuel.priceLog);
        //     return;
        // }

        // Check if we have the price in the database
        db.getFuelPrices(countryCode).then((fuelPrices) => {
            var fetchNewPrices = false;
            var dateCutOff = new Date();
            dateCutOff.setHours(dateCutOff.getHours() - 24);

            if (fuelPrices) {
                console.log("Found fuel prices in DB!");

                if (fuelPrices.last_updated_at < dateCutOff) {
                    console.log("Out of date, fetching new prices");
                    fetchNewPrices = true;
                }
            } else {
                fetchNewPrices = true;
            }

            if (!fetchNewPrices) {
                ws.send(JSON.stringify({
                    type:        "fuelPrices",
                    containerID: containerID,
                    data:        fuelPrices
                }));

                resolve();
                return;
            } else {
                // If not DB then scrape webpage
                fuel.getFuelPrice(countryCode).then((newFuelPrices) => {
                    // Once we get our data from webpage, let's
                    // 1. Log it in DB, and
                    // 2. Return it
                    db.insertNewFuelPrices(newFuelPrices, fuel.webpageSourceID()).then((result) => {
                        // We successfully logged new entries, now send this data to client
                    });

                    ws.send(JSON.stringify({
                        type: "fuelPrices",
                        data: newFuelPrices
                    }));

                    resolve();
                    return;
                }).catch((err) => {
                    console.log("Unable to get fuel prices from webpage");
                    reject(err);
                });
            }
        }).catch((err) => {
            console.log("Unable to get fuel prices from database");
            reject(err);
        });
    });
}
//#endregion

//#region Websocket Msgs
webSocket.on("connection", function connection(ws) {
    ws.on("message", function message(req) {
        req = JSON.parse(req);
        console.log(req);

        if (!req)        { return; }
        if (!req.action) { return; }
        
        var containerID = req.containerID;

        switch (req.action.trim().toLowerCase()) {
            case "requestmakes":
                getMakes(ws, containerID);
                break;

            case "requestmodels":
                var makeID = req.makeID;
                
                getModels(ws, containerID, makeID);
                break;

            case "requestyears":
                var makeID  = req.makeID;
                var modelID = req.modelID;
                
                getYears(ws, containerID, makeID, modelID);
                break;

            case "requestfueltypes":
                var makeID  = req.makeID;
                var modelID = req.modelID;
                var year    = req.year;
                
                getFuelTypes(ws, containerID, makeID, modelID, year);
                break;

            case "requestenginesizes":
                var makeID     = req.makeID;
                var modelID    = req.modelID;
                var year       = req.year;
                var fuelTypeID = req.fuelTypeID;
                
                getEngineSizes(ws, containerID, makeID, modelID, year, fuelTypeID);
                break;

            case "requestfueleconomies":
                var makeID      = req.makeID;
                var modelID     = req.modelID;
                var year        = req.year;
                var fuelTypeID  = req.fuelTypeID;
                var engineSize  = req.engineSize;
                
                getFuelEconomies(ws, containerID, makeID, modelID, year, fuelTypeID, engineSize);
                break;

            case "requestcurrencyconversion":
                getCurrencyConversion(ws);
                break;

            case "requestfuelprices":
                var countryCode = req.countryCode;
                var fuelID      = req.fuelID;

                if (!countryCode) { return; }

                getFuelPrices(ws, containerID, countryCode, fuelID).then((res) => {
                    // send these prices to the client
                    console.log(res);
                });

                break;

            default:
                break;
        }
    });
});

//#endregion