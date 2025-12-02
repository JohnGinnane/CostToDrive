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

// Used to convert currencies
var apiCurrencyKey = "";

// Create default values config
var config = {
    api_currency_key: "",
    last_started:     new Date().toISOString()
}

function log(str) {
    var today  = new Date();
    console.log("[" + today.toLocaleTimeString("en-IE") + "]", str);
}

//console.log(new Date().toISOString());
function saveConfig(filepath, obj) {
    log("Saving config");
    fs.writeFileSync(filepath, JSON.stringify(obj, null, 4), "utf-8");
}

// Check if config file exists
fs.statSync("./config.json", function(err, stats) {
    if (err) {
        if (err.code === "ENOENT") {
            log("Config file not found, creating one");
            saveConfig("./config.json", config);
        } else {
            // Fatal error trying to read the
            // the file, which we really need
            console.log(err);
            process.exit(-1);
        }
    } else {
        // We need to open the file and load it into a variable
        config = JSON.parse(fs.readFileSync("./config.json", { encoding: "utf-8", flag: "r" }));
        log("Last started: " + new Date(config.last_started).toLocaleString());
        config.last_started = new Date().toISOString();
        saveConfig("./config.json", config);
    }

    apiCurrencyKey = config.api_currency_key;
});

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

// // Get conversions
// https.get(`https://api.currencyapi.com/v3/latest?apikey=${apiCurrencyKey}&currencies=GBP%2CUSD%2CCAD&base_currency=EUR`, resp => {
//     let data = ''
//     resp.on('data', chunk => {
//         data += chunk;
//     });

//     resp.on("end", () => {
//         var peopleData = JSON.parse(data);
//         console.log(peopleData);
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
