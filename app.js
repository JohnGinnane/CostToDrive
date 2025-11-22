var createError  = require('http-errors');
var express      = require('express');
var path         = require('path');
var cookieParser = require('cookie-parser');
var logger       = require('morgan');

var indexRouter  = require('./routes/index');
var usersRouter  = require('./routes/users');
var db           = require("./db");

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

function log(str) {
    var today  = new Date();
    console.log("[" + today.toLocaleTimeString("en-IE") + "]", str);
}

app.use(express.static(path.join(__dirname, "public")));

// WEB SOCKET
const ws             = require("ws");
//const uuid           = require("uuid");
const https          = require("https");
const http           = require("http");
const selfsigned     = require("selfsigned");

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
                var makeID = req.makeID.trim().toLowerCase();
                
                getModels(ws, makeID);
                break;

            case "requestyears":
                var makeID  = req.makeID.trim().toLowerCase();
                var modelID = req.modelID.trim().toLowerCase();
                
                getYears(ws, makeID, modelID);
                break;

            case "requestfueltypes":
                var makeID  = req.makeID.trim().toLowerCase();
                var modelID = req.modelID.trim().toLowerCase();
                var year    = req.year.trim();
                
                getFuelTypes(ws, makeID, modelID, year);
                break;

            case "requestenginesizes":
                var makeID     = req.makeID.trim();
                var modelID    = req.modelID.trim();
                var year       = req.year.trim();
                var fuelTypeID = req.fuelTypeID.trim();
                
                getEngineSizes(ws, makeID, modelID, year, fuelTypeID);
                break;

            case "template":
                break;

            default:
                break;
        }
    });
});
