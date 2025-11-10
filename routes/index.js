var express = require('express');
var router = express.Router();
var db = require("../db");
var makes = "";

/* GET home page. */
router.get('/', function(req, res, next) {
    getMakes();
    res.render('index', { title: 'Express' });
});

function getMakes() {
    db.serialize(() => {
        db.each("SELECT [MAK].[ID], [MAK].[Name] FROM [Makes] AS [MAK];", (err, row) => {
            if (!err) {
                // console.log(1);
                // makes += '<option value="' + row.ID + '">' + row.Name + '</option>\n'
            } else {
                console.log(err);
                return;
            }
        });
    });
}

module.exports = router;