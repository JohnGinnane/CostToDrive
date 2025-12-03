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

// Create default values config
var config = {
    api_currency_key: "",
    last_started:     new Date().toISOString()
}

function log(str) {
    var today  = new Date();
    console.log("[" + today.toLocaleTimeString("en-IE") + "]", str);
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
        console.log(err);
        process.exit(-1);
    }
}

log("config done");

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

// Check database for latest currency conversions
// Get the most recent (if any!), and when it was
// last fetched from API
// This object will contain a list of currency codes and their rates
// Whichever rate has a value of 1.0 is considered the "prime" currency
// In order to convery from currency X to currency Y, we must first convert
// to from X to "prime", then from "prime" to Y
// var currencyConversion = db.getCurrencyRates();

// console.log(currencyConversion);

async function idk() {
    db.getCurrencyRates().then((res) => {
        console.log(res);
    }).finally(() => {
        console.log("fuck me");
    })
}

idk();

// Get conversions
log("Getting up to date currency exchange rates...");
const apiBaseURL = "https://api.currencyapi.com/";

// https.get(`${apiBaseURL}v3/latest?apikey=${config.api_currency_key}&currencies=GBP%2CUSD%2CCAD&base_currency=EUR`, resp => {
//     let data = ''
//     resp.on('data', chunk => {
//         data += chunk;
//     });

//     resp.on("end", () => {
//         var currencyData = JSON.parse(data);
//         console.log(currencyData);
//         log("currency done");

//         // Need to get next batch number from currency log table
//         // then insert new batch of exchange rates
//         db.serialize(() => {
//             db.each(`SELECT MAX([CCL].[Batch]) + 1 AS [NextBatch]
//                        FROM [CurrencyConversionLog] AS [CCL]`,
//                     (err, row) => {
//                 if (!err) {
//                     var nextBatch = row.NextBatch;
//                     var timeStamp = currencyData.meta.last_updated_at;
                    
//                     log(`Inserting currency rates batch ${nextBatch}`);
                    
//                     // First, insert our base currency with a value of 1.00
//                     var sql = `INSERT INTO [CurrencyConversionLog] (
//                                       [SourceID],
//                                       [Batch],
//                                       [Timestamp],
//                                       [Currency],
//                                       [Value])
//                                SELECT (SELECT [SRC].[ID] FROM [Sources] AS [SRC] WHERE [SRC].[URL] = '${apiBaseURL}' LIMIT 1) AS [SourceID],
//                                       ${nextBatch},
//                                       '${timeStamp}',
//                                       'EUR',
//                                       1.00`;
                    
//                     // log(sql);
//                     db.run(sql);

//                     // Iterate over currencies and insert
//                     Object.keys(currencyData.data).forEach(function(currency) {
//                         var currency_code = currencyData.data[currency].code;
//                         var currency_rate = currencyData.data[currency].value;
                        
//                         var sql = `INSERT INTO [CurrencyConversionLog] (
//                                           [SourceID],
//                                           [Batch],
//                                           [Timestamp],
//                                           [Currency],
//                                           [Value])
//                                       SELECT (SELECT [SRC].[ID] FROM [Sources] AS [SRC] WHERE [SRC].[URL] = '${apiBaseURL}' LIMIT 1) AS [SourceID],
//                                           ${nextBatch},
//                                           '${timeStamp}',
//                                           '${currency_code}',
//                                           ${currency_rate}`;

//                         // log(sql);
//                         db.run(sql);
//                     });
//                 } else {
//                     console.error(err);
//                 }
//             });
//         });
//     });
// });

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

// WEB SOCKET
const ws             = require("ws");
//const uuid           = require("uuid");
const selfsigned     = require("selfsigned");
const { DATE } = require('sequelize');

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

// Web Socket Functions
function getMakes(ws) {
    db.serialize(() => {
        db.each(`SELECT [MAK].[ID] AS [MakeID],
                        [MAK].[Name] AS [Name]
                   FROM [Makes] AS [MAK];`,
                (err, row) => {
            if (!err) {
                ws.send(JSON.stringify({
                    type: "make",
                    data: {
                        MakeID: row.MakeID,
                        Name: row.Name
                    }
                }));
            } else {
                console.log(err);
            }
        });
    });
}

function getModels(ws, makeID) {
    db.serialize(() => {
        db.each(`SELECT [MOD].[ID] AS [ModelID],
                        [MOD].[Name] AS [Name]
                   FROM [Models] AS [MOD]
                  WHERE [MOD].[MakeID] = $makeID`, { $makeID: makeID },
                (err, row) => {
                    if (!err) {
                        ws.send(JSON.stringify({
                            type: "model",
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

function getYears(ws, makeID, modelID) {
    db.serialize(() => {
        db.each(`SELECT [VEH].[Year]
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

function getFuelTypes(ws, makeID, modelID, year) {
    db.serialize(() => {
        db.each(`SELECT [FT].[ID],
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

function getEngineSizes(ws, makeID, modelID, year, fuelTypeID) {
    db.serialize(() => {
        db.each(`SELECT [VEH].[Displacement] AS [EngineSize]
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

function getFuelEconomies(ws, makeID, modelID, year, fuelTypeID, engineSize) {
    db.serialize(() => {
        db.each(`SELECT AVG([UrbanKMPL]) AS [AvgUrbanKMPL],
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
                            type: "fueleconomy",
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

webSocket.on("connection", function connection(ws) {
    ws.on("message", function message(req) {
        req = JSON.parse(req);
        console.log(req);

        if (!req)        { return; }
        if (!req.action) { return; }

        switch (req.action.trim().toLowerCase()) {
            case "requestmakes":
                getMakes(ws);
                break;

            case "requestmodels":
                var makeID = req.makeID;
                
                getModels(ws, makeID);
                break;

            case "requestyears":
                var makeID  = req.makeID;
                var modelID = req.modelID;
                
                getYears(ws, makeID, modelID);
                break;

            case "requestfueltypes":
                var makeID  = req.makeID;
                var modelID = req.modelID;
                var year    = req.year;
                
                getFuelTypes(ws, makeID, modelID, year);
                break;

            case "requestenginesizes":
                var makeID     = req.makeID;
                var modelID    = req.modelID;
                var year       = req.year;
                var fuelTypeID = req.fuelTypeID;
                
                getEngineSizes(ws, makeID, modelID, year, fuelTypeID);
                break;

            case "requestfueleconomies":
                var makeID     = req.makeID;
                var modelID    = req.modelID;
                var year       = req.year;
                var fuelTypeID = req.fuelTypeID;
                var engineSize = req.engineSize;
                
                getFuelEconomies(ws, makeID, modelID, year, fuelTypeID, engineSize);
                break;

            case "template":
                break;

            default:
                break;
        }
    });
});
