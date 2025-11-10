var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// SQLite server
const sqlite3 = require("sqlite3").verbose()

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

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

// Load the database
const db = new sqlite3.Database("costtodrive.db");

db.serialize(() => {
    db.each("SELECT [ID], [Name] FROM [Makes] AS [MAK]", (err, row) => {
        //console.log(`${row.ID} - ${row.Name}`);
        console.log(row);
    });
})

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
